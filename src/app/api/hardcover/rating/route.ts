import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { fetchCurrentlyReading, fetchFinishedBooks, fetchWantToRead, updateBookRating } from '@/lib/hardcover'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.hardcoverApiToken) {
      return NextResponse.json({ error: 'Hardcover not connected' }, { status: 400 })
    }

    const token = decrypt(user.hardcoverApiToken)
    const { bookId, rating, userBookId, bookTitle, bookAuthor, bookCoverUrl } = await request.json()

    if (!bookId || rating == null || rating < 0 || rating > 5 || (rating % 0.5 !== 0)) {
      return NextResponse.json({ error: 'bookId and rating (0-5, in 0.5 increments) are required' }, { status: 400 })
    }

    // Fast path: use userBookId directly if provided by client
    let resolvedUserBookId = userBookId
    if (!resolvedUserBookId) {
      // Fallback: find the user_book entry by fetching all books
      const [reading, finished, wantToRead] = await Promise.all([
        fetchCurrentlyReading(token),
        fetchFinishedBooks(token, 100),
        fetchWantToRead(token),
      ])
      const allBooks = [...reading, ...finished, ...wantToRead]
      const userBook = allBooks.find((ub: any) => ub.book.id === bookId)
      if (!userBook) {
        return NextResponse.json({ error: 'Book not found in your library' }, { status: 404 })
      }
      resolvedUserBookId = userBook.id
    }

    const result = await updateBookRating(token, resolvedUserBookId, rating)

    // Write activity event
    await prisma.activityEvent.create({
      data: {
        userId: user.id,
        type: 'rating',
        hardcoverBookId: String(bookId),
        bookTitle: bookTitle || null,
        bookAuthor: bookAuthor || null,
        bookCoverUrl: bookCoverUrl || null,
        value: rating === 0 ? 'cleared' : `${rating}`,
        visibility: 'global',
      },
    }).catch((e) => console.error('Activity event write failed:', e))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Rating update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
