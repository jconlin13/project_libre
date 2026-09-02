import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isHardcoverId } from '@/lib/book-id'

export const dynamic = 'force-dynamic'

/**
 * The user's whole library, grouped by shelf.
 *
 * Reads from Snapshot rather than Hardcover directly, because Snapshot is the
 * one place both sources land: Hardcover accounts sync into it, and imported
 * libraries are written straight to it. That means this works for a user who
 * has never connected Hardcover at all.
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const snapshots = await prisma.snapshot.findMany({
      where: { userId: user.id },
      orderBy: [{ lastReadDate: 'desc' }, { bookTitle: 'asc' }],
    })

    const rankings = await prisma.bookRanking.findMany({
      where: { userId: user.id },
      select: { hardcoverBookId: true, eloScore: true, manualOverride: true },
    })
    const rankedIds = new Set(rankings.map(r => r.hardcoverBookId))

    const shape = (s: (typeof snapshots)[number]) => ({
      hardcoverBookId: s.hardcoverBookId,
      bookTitle: s.bookTitle,
      bookAuthor: s.bookAuthor,
      bookCoverUrl: s.bookCoverUrl,
      statusId: s.statusId,
      rating: s.rating,
      progressPct: s.progressPct,
      lastReadDate: s.lastReadDate,
      dateAdded: s.dateAdded,
      isRanked: rankedIds.has(s.hardcoverBookId),
      // Imported books have no Hardcover page to link out to
      isHardcover: isHardcoverId(s.hardcoverBookId),
    })

    const byStatus = {
      currentlyReading: snapshots.filter(s => s.statusId === 2).map(shape),
      read: snapshots.filter(s => s.statusId === 3).map(shape),
      wantToRead: snapshots.filter(s => s.statusId === 1).map(shape),
      didNotFinish: snapshots.filter(s => s.statusId === 5).map(shape),
    }

    return NextResponse.json({
      data: {
        ...byStatus,
        total: snapshots.length,
        hasHardcover: !!user.hardcoverApiToken,
      },
    })
  } catch (error) {
    console.error('Library error:', error)
    return NextResponse.json({ error: 'Failed to fetch library' }, { status: 500 })
  }
}
