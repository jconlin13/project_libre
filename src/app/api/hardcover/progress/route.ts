import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { fetchCurrentlyReading, updateReadingProgress } from '@/lib/hardcover'

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
    const body = await request.json()
    const { bookId, progress, progressPages, userBookId, readId, bookTitle, bookAuthor, bookCoverUrl, mediaType } = body

    if (!bookId) {
      return NextResponse.json({ error: 'bookId is required' }, { status: 400 })
    }

    if (progress == null && progressPages == null) {
      return NextResponse.json({ error: 'progress or progressPages is required' }, { status: 400 })
    }

    // Fast path: use userBookId and readId directly if provided by client
    let resolvedUserBookId = userBookId
    let resolvedReadId = readId ?? null
    if (!resolvedUserBookId) {
      const reading = await fetchCurrentlyReading(token)
      const userBook = reading.find((ub: any) => ub.book.id === bookId)
      if (!userBook) {
        return NextResponse.json({ error: 'Book not found in currently reading list' }, { status: 404 })
      }
      resolvedUserBookId = userBook.id
      resolvedReadId = userBook.user_book_reads?.[0]?.id || null
    }

    const result = await updateReadingProgress(
      token,
      resolvedUserBookId,
      resolvedReadId,
      progress ?? undefined,
      progressPages ?? undefined,
    )

    // Write activity event
    const progressValue = progress != null
      ? `${Math.min(progress, 100)}%`
      : `page ${progressPages}`
    await prisma.activityEvent.create({
      data: {
        userId: user.id,
        type: 'progress_update',
        hardcoverBookId: String(bookId),
        bookTitle: bookTitle || null,
        bookAuthor: bookAuthor || null,
        bookCoverUrl: bookCoverUrl || null,
        value: progressValue,
        mediaType: mediaType || null,
        visibility: 'global',
      },
    }).catch((e) => console.error('Activity event write failed:', e))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Progress update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
