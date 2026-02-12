import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
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
    const { bookId, rating } = await request.json()

    if (!bookId || rating == null || rating < 0 || rating > 5 || (rating % 0.5 !== 0)) {
      return NextResponse.json({ error: 'bookId and rating (0-5, in 0.5 increments) are required' }, { status: 400 })
    }

    // Find the user_book entry for this book
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

    const result = await updateBookRating(token, userBook.id, rating)
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Rating update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
