import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { fetchCurrentlyReading, fetchFinishedBooks, fetchWantToRead, updateBookStatus } from '@/lib/hardcover'
import { isHardcoverId } from '@/lib/book-id'

const VALID_STATUS_IDS = [1, 2, 3, 5] // 1=Want to Read, 2=Currently Reading, 3=Read, 5=Did Not Finish
const STATUS_LABELS: Record<number, string> = {
  1: 'Want to Read',
  2: 'Currently Reading',
  3: 'Read',
  5: 'Did Not Finish',
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId, statusId, userBookId, bookTitle, bookAuthor, bookCoverUrl, mediaType } = await request.json()

    if (!bookId || !VALID_STATUS_IDS.includes(statusId)) {
      return NextResponse.json({ error: 'bookId and valid statusId (1, 2, 3, 5) are required' }, { status: 400 })
    }

    // The local shelf is the record of truth. Write it first so the change
    // sticks whether or not the user has Hardcover connected, and stamp
    // localUpdatedAt so a later sync can't revert it.
    await prisma.snapshot.upsert({
      where: {
        userId_hardcoverBookId: { userId: user.id, hardcoverBookId: String(bookId) },
      },
      create: {
        userId: user.id,
        type: 'user_book',
        hardcoverBookId: String(bookId),
        statusId,
        bookTitle: bookTitle || null,
        bookAuthor: bookAuthor || null,
        bookCoverUrl: bookCoverUrl || null,
        lastReadDate: statusId === 3 ? new Date() : null,
        localUpdatedAt: new Date(),
      },
      update: {
        statusId,
        ...(bookTitle ? { bookTitle } : {}),
        ...(bookAuthor ? { bookAuthor } : {}),
        ...(bookCoverUrl ? { bookCoverUrl } : {}),
        ...(statusId === 3 ? { lastReadDate: new Date() } : {}),
        localUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Then mirror it to Hardcover when connected. A failure there is reported
    // but doesn't undo the local change — this app doesn't depend on it.
    let result: unknown = null
    let hardcoverSynced = false
    let hardcoverError: string | null = null

    if (user.hardcoverApiToken && isHardcoverId(String(bookId))) {
      try {
        const token = decrypt(user.hardcoverApiToken)
        let resolvedUserBookId = userBookId
        if (!resolvedUserBookId) {
          const [reading, finished, wantToRead] = await Promise.all([
            fetchCurrentlyReading(token),
            fetchFinishedBooks(token, 100),
            fetchWantToRead(token),
          ])
          const allBooks: Array<{ id: number; book: { id: number } }> =
            [...reading, ...finished, ...wantToRead]
          const userBook = allBooks.find(ub => ub.book.id === bookId)
          resolvedUserBookId = userBook?.id
        }
        if (resolvedUserBookId) {
          result = await updateBookStatus(token, resolvedUserBookId, statusId)
          hardcoverSynced = true
        }
      } catch (err) {
        hardcoverError = err instanceof Error ? err.message : 'Hardcover sync failed'
        console.error('Hardcover status write-back failed:', err)
      }
    }

    // Write activity event
    await prisma.activityEvent.create({
      data: {
        userId: user.id,
        type: 'status_change',
        hardcoverBookId: String(bookId),
        bookTitle: bookTitle || null,
        bookAuthor: bookAuthor || null,
        bookCoverUrl: bookCoverUrl || null,
        value: STATUS_LABELS[statusId] || String(statusId),
        mediaType: mediaType || null,
        visibility: 'global',
      },
    }).catch((e) => console.error('Activity event write failed:', e))

    return NextResponse.json({ data: { result, hardcoverSynced, hardcoverError } })
  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
