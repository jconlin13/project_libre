import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseBookId } from '@/lib/book-id'
import { resolveCover } from '@/lib/cover-lookup'

export const dynamic = 'force-dynamic'

// Open Library search costs ~1s per book, so a whole library can't be done in
// one request. The client calls this repeatedly until `remaining` hits zero,
// which also keeps us to a polite request rate.
const BATCH_SIZE = 8

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Optional: re-check books we've already tried (used by a manual retry)
    const { retryAll } = (await request.json().catch(() => ({}))) as { retryAll?: boolean }

    // Import sets an ISBN cover URL optimistically without checking it, so
    // "needs work" means unverified rather than empty — a stored URL may well
    // be a 404. resolveCover confirms it with a cheap HEAD before searching.
    const pendingWhere = retryAll
      ? { userId: user.id, OR: [{ bookCoverUrl: null }, { bookCoverUrl: '' }] }
      : { userId: user.id, coverCheckedAt: null }

    const [batch, remainingBefore] = await Promise.all([
      prisma.snapshot.findMany({
        where: pendingWhere,
        take: BATCH_SIZE,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.snapshot.count({ where: pendingWhere }),
    ])

    if (batch.length === 0) {
      return NextResponse.json({ data: { processed: 0, found: 0, remaining: 0, done: true } })
    }

    let found = 0
    for (const snap of batch) {
      const parsed = parseBookId(snap.hardcoverBookId)
      const isbn = parsed.source === 'isbn' ? parsed.value : null

      let url: string | null = null
      if (snap.bookTitle) {
        const result = await resolveCover(snap.bookTitle, snap.bookAuthor, isbn)
        url = result.url
      }
      if (url) found++

      await prisma.snapshot.update({
        where: { id: snap.id },
        data: {
          // Stamp the attempt either way so we don't re-query books with no art
          coverCheckedAt: new Date(),
          // Clear a stored URL that turned out to be a dead ISBN link, so the
          // tile falls back to a title card instead of an empty box
          bookCoverUrl: url,
        },
      })
    }

    return NextResponse.json({
      data: {
        processed: batch.length,
        found,
        remaining: Math.max(0, remainingBefore - batch.length),
        done: remainingBefore - batch.length <= 0,
      },
    })
  } catch (error) {
    console.error('Cover enrichment error:', error)
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}

// How many books are still missing art — lets the UI offer the action only
// when there's something to do.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [missing, unchecked] = await Promise.all([
      prisma.snapshot.count({
        where: { userId: user.id, OR: [{ bookCoverUrl: null }, { bookCoverUrl: '' }] },
      }),
      prisma.snapshot.count({
        where: { userId: user.id, coverCheckedAt: null },
      }),
    ])

    return NextResponse.json({ data: { missing, unchecked } })
  } catch (error) {
    console.error('Cover status error:', error)
    return NextResponse.json({ error: 'Failed to check covers' }, { status: 500 })
  }
}
