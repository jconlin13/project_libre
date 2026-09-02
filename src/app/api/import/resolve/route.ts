import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBookLookupToken } from '@/lib/hardcover-token'
import { lookupBooksByIsbn, type HardcoverBook } from '@/lib/hardcover'
import { parseBookId } from '@/lib/book-id'

export const dynamic = 'force-dynamic'

// 20 ISBNs resolve in a single ~300ms request; this keeps us far under the
// 60/minute limit while still finishing a large library in a few passes.
const BATCH_SIZE = 20
// Cap per request so a huge library can't blow the request timeout or the
// per-minute rate limit; the client calls again while progress is being made.
const MAX_PER_REQUEST = 200

const CHUNK_DELAY_MS = 1200

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Hardcover answers a burst of requests then returns 429 with "try again in N
 * seconds". Honor that rather than giving up: a library resolves in a handful
 * of chunks, and abandoning the run over a one-second pause would leave most
 * of it unmatched.
 */
async function lookupChunkWithRetry(
  token: string,
  chunk: string[],
  attempts = 3
): Promise<Map<string, HardcoverBook>> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await lookupBooksByIsbn(token, chunk)
    } catch (err) {
      lastError = err
      const message = err instanceof Error ? err.message : ''
      const isRateLimit = message.includes('429') || /rate limit/i.test(message)
      if (!isRateLimit) throw err
      const seconds = Number(message.match(/again in (\d+)\s*second/i)?.[1] ?? 0)
      await sleep(Math.max(seconds * 1000, 1500) * (attempt + 1))
    }
  }
  throw lastError
}

function coverUrlOf(book: HardcoverBook): string | null {
  const img = book.cached_image
  if (!img) return null
  if (typeof img === 'string') {
    try { return (JSON.parse(img) as { url?: string })?.url || null } catch { return null }
  }
  return img.url || null
}

function authorOf(book: HardcoverBook): string | null {
  return book.cached_contributors?.[0]?.author?.name || null
}

/**
 * Re-key one imported book onto its real Hardcover id.
 *
 * Imported books are keyed by ISBN because that's all a CSV gives us. Once
 * Hardcover tells us which book that ISBN is, switching to the Hardcover id
 * makes the book a first-class citizen — its detail page loads, and it merges
 * with the same book already in the library instead of sitting beside it as a
 * duplicate.
 *
 * Rows are moved table by table. Where a row for the Hardcover id already
 * exists, the imported one is dropped rather than merged: the existing row is
 * either Hardcover-synced or already locally edited, and in both cases it is
 * the better record.
 */
async function migrateBookId(userId: string, fromId: string, toId: string, book: HardcoverBook) {
  const coverUrl = coverUrlOf(book)
  const author = authorOf(book)

  await prisma.$transaction(async tx => {
    // --- Snapshot: unique on (userId, hardcoverBookId) ---
    const [imported, existing] = await Promise.all([
      tx.snapshot.findUnique({ where: { userId_hardcoverBookId: { userId, hardcoverBookId: fromId } } }),
      tx.snapshot.findUnique({ where: { userId_hardcoverBookId: { userId, hardcoverBookId: toId } } }),
    ])

    if (imported) {
      if (existing) {
        // Keep the existing row, but let it inherit anything the import knew
        // that it doesn't — a read date, a rating, a shelf set deliberately.
        await tx.snapshot.update({
          where: { id: existing.id },
          data: {
            statusId: existing.localUpdatedAt ? existing.statusId : imported.statusId,
            rating: existing.rating ?? imported.rating,
            lastReadDate: existing.lastReadDate ?? imported.lastReadDate,
            dateAdded: existing.dateAdded ?? imported.dateAdded,
            bookTitle: book.title,
            bookAuthor: author,
            ...(coverUrl ? { bookCoverUrl: coverUrl } : {}),
            localUpdatedAt: existing.localUpdatedAt ?? imported.localUpdatedAt,
          },
        })
        await tx.snapshot.delete({ where: { id: imported.id } })
      } else {
        await tx.snapshot.update({
          where: { id: imported.id },
          data: {
            hardcoverBookId: toId,
            bookTitle: book.title,
            bookAuthor: author,
            ...(coverUrl ? { bookCoverUrl: coverUrl } : {}),
          },
        })
      }
    }

    // --- BookRanking: unique on (userId, hardcoverBookId) ---
    const [impRank, existRank] = await Promise.all([
      tx.bookRanking.findUnique({ where: { userId_hardcoverBookId: { userId, hardcoverBookId: fromId } } }),
      tx.bookRanking.findUnique({ where: { userId_hardcoverBookId: { userId, hardcoverBookId: toId } } }),
    ])
    if (impRank) {
      if (existRank) {
        // A score refined by comparisons outranks an imported seed
        await tx.bookRanking.delete({ where: { id: impRank.id } })
      } else {
        await tx.bookRanking.update({
          where: { id: impRank.id },
          data: {
            hardcoverBookId: toId,
            bookTitle: book.title,
            bookAuthor: author,
            ...(coverUrl ? { bookCoverUrl: coverUrl } : {}),
          },
        })
      }
    }

    // --- UserBookMediaType: unique on (userId, hardcoverBookId) ---
    const impMedia = await tx.userBookMediaType.findUnique({
      where: { userId_hardcoverBookId: { userId, hardcoverBookId: fromId } },
    })
    if (impMedia) {
      const existMedia = await tx.userBookMediaType.findUnique({
        where: { userId_hardcoverBookId: { userId, hardcoverBookId: toId } },
      })
      if (existMedia) await tx.userBookMediaType.delete({ where: { id: impMedia.id } })
      else await tx.userBookMediaType.update({ where: { id: impMedia.id }, data: { hardcoverBookId: toId } })
    }

    // --- Tables without a uniqueness constraint: a plain re-key is safe ---
    await tx.plusOne.updateMany({
      where: { userId, hardcoverBookId: fromId },
      data: { hardcoverBookId: toId, bookTitle: book.title, bookAuthor: author },
    })
    await tx.recommendation.updateMany({
      where: { hardcoverBookId: fromId, OR: [{ fromUserId: userId }, { toUserId: userId }] },
      data: { hardcoverBookId: toId, bookTitle: book.title, bookAuthor: author },
    })
    await tx.activityEvent.updateMany({
      where: { userId, hardcoverBookId: fromId },
      data: { hardcoverBookId: toId, bookTitle: book.title, bookAuthor: author },
    })
    await tx.bookComparison.updateMany({ where: { userId, winnerBookId: fromId }, data: { winnerBookId: toId } })
    await tx.bookComparison.updateMany({ where: { userId, loserBookId: fromId }, data: { loserBookId: toId } })
  })
}

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = await getBookLookupToken(user.id)
    if (!token) {
      return NextResponse.json(
        { data: { resolved: 0, unmatched: 0, remaining: 0, done: true, unavailable: true } }
      )
    }

    // Walk the whole pending list within this request rather than paging.
    // A book Hardcover doesn't recognize keeps its ISBN id, so a paged query
    // would hand back the same unmatched books forever and never reach the
    // ones behind them.
    const pending = await prisma.snapshot.findMany({
      where: { userId: user.id, hardcoverBookId: { startsWith: 'isbn:' } },
      select: { hardcoverBookId: true },
      take: MAX_PER_REQUEST,
      orderBy: { id: 'asc' },
    })

    if (pending.length === 0) {
      return NextResponse.json({ data: { resolved: 0, unmatched: 0, remaining: 0, done: true, total: 0 } })
    }

    const allIsbns = pending.map(p => parseBookId(p.hardcoverBookId).value)
    let resolved = 0
    let unmatched = 0

    for (let i = 0; i < allIsbns.length; i += BATCH_SIZE) {
      const chunk = allIsbns.slice(i, i + BATCH_SIZE)

      // Hardcover allows a small burst then refills per second, so back-to-back
      // chunks trip a 429 after roughly six requests. Pace them.
      if (i > 0) await sleep(CHUNK_DELAY_MS)

      let found: Map<string, HardcoverBook>
      try {
        found = await lookupChunkWithRetry(token, chunk)
      } catch (err) {
        // Still failing after a backoff — stop cleanly and let the client
        // resume; everything resolved so far is already committed.
        console.error('Hardcover lookup failed mid-run:', err)
        break
      }

      for (const isbn of chunk) {
        const book = found.get(isbn)
        if (!book) {
          unmatched++
          continue
        }
        try {
          await migrateBookId(user.id, `isbn:${isbn}`, String(book.id), book)
          resolved++
        } catch (err) {
          console.error(`Failed to re-key isbn:${isbn}:`, err)
          unmatched++
        }
      }
    }

    const remaining = await prisma.snapshot.count({
      where: { userId: user.id, hardcoverBookId: { startsWith: 'isbn:' } },
    })

    return NextResponse.json({
      data: {
        resolved,
        unmatched,
        remaining,
        // Everything still on an ISBN id was attempted and missed, unless we
        // hit the per-request cap and there is genuinely more to walk.
        done: remaining === 0 || resolved === 0,
        total: pending.length,
      },
    })
  } catch (error) {
    console.error('ISBN resolution error:', error)
    return NextResponse.json({ error: 'Resolution failed' }, { status: 500 })
  }
}
