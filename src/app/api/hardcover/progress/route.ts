import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
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
    const { bookId, progress, progressPages } = body

    if (!bookId) {
      return NextResponse.json({ error: 'bookId is required' }, { status: 400 })
    }

    if (progress == null && progressPages == null) {
      return NextResponse.json({ error: 'progress or progressPages is required' }, { status: 400 })
    }

    // Find the user_book entry and existing read for this book
    const reading = await fetchCurrentlyReading(token)
    const userBook = reading.find((ub: any) => ub.book.id === bookId)

    if (!userBook) {
      return NextResponse.json({ error: 'Book not found in currently reading list' }, { status: 404 })
    }

    const existingRead = userBook.user_book_reads?.[0]

    const result = await updateReadingProgress(
      token,
      userBook.id,
      existingRead?.id || null,
      progress ?? undefined,
      progressPages ?? undefined,
    )

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Progress update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
