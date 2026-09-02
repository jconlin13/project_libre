import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * The caller's own shelf state for one book, straight from the local snapshot.
 *
 * The book detail page used to derive this from Hardcover's shelves, which
 * meant a book showed as "not in your library" for anyone without a Hardcover
 * account — including everyone who arrived by importing a CSV. Snapshot is the
 * record of truth for status (see localUpdatedAt), so read it directly.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookId = new URL(request.url).searchParams.get('bookId')
    if (!bookId) {
      return NextResponse.json({ error: 'bookId required' }, { status: 400 })
    }

    const snap = await prisma.snapshot.findUnique({
      where: { userId_hardcoverBookId: { userId: user.id, hardcoverBookId: bookId } },
      select: {
        statusId: true,
        rating: true,
        progressPct: true,
        lastReadDate: true,
        dateAdded: true,
        localUpdatedAt: true,
      },
    })

    return NextResponse.json({ data: snap })
  } catch (error) {
    console.error('Book status error:', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
