import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
import { fetchCurrentlyReading, fetchFinishedBooks, fetchWantToRead, updateBookStatus } from '@/lib/hardcover'

const VALID_STATUS_IDS = [1, 2, 3, 5] // 1=Want to Read, 2=Currently Reading, 3=Read, 5=Did Not Finish

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
    const { bookId, statusId, userBookId } = await request.json()

    if (!bookId || !VALID_STATUS_IDS.includes(statusId)) {
      return NextResponse.json({ error: 'bookId and valid statusId (1, 2, 3, 5) are required' }, { status: 400 })
    }

    // Fast path: use userBookId directly if provided by client
    let resolvedUserBookId = userBookId
    if (!resolvedUserBookId) {
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

    const result = await updateBookStatus(token, resolvedUserBookId, statusId)
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
