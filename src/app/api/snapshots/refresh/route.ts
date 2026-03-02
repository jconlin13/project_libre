import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { fetchAllUserBooks } from '@/lib/hardcover'

const STALE_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

const STATUS_LABELS: Record<number, string> = {
  1: 'Want to Read',
  2: 'Currently Reading',
  3: 'Read',
  5: 'Did Not Finish',
}

function extractCoverUrl(cachedImage: unknown): string | null {
  if (!cachedImage) return null
  if (typeof cachedImage === 'string') {
    try { return (JSON.parse(cachedImage) as { url?: string })?.url || null }
    catch { return null }
  }
  return (cachedImage as { url?: string })?.url || null
}

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get household members
    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { householdId: true }
    })
    const householdIds = memberships.map(m => m.householdId)

    if (householdIds.length === 0) {
      return NextResponse.json({ data: { refreshed: 0 } })
    }

    const allMembers = await prisma.householdMember.findMany({
      where: { householdId: { in: householdIds } },
      include: { user: true }
    })
    const uniqueMembers = [...new Map(allMembers.map(m => [m.userId, m.user])).values()]

    let refreshedCount = 0

    for (const member of uniqueMembers) {
      if (!member.hardcoverApiToken) continue

      // Check staleness: skip if updated within threshold
      const latestSnapshot = await prisma.snapshot.findFirst({
        where: { userId: member.id },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      })

      if (latestSnapshot && Date.now() - latestSnapshot.updatedAt.getTime() < STALE_THRESHOLD_MS) {
        continue
      }

      try {
        const token = decrypt(member.hardcoverApiToken)
        const userBooks = await fetchAllUserBooks(token)

        // Get existing snapshots for this member
        const existingSnapshots = await prisma.snapshot.findMany({
          where: { userId: member.id }
        })
        const snapshotMap = new Map(existingSnapshots.map(s => [s.hardcoverBookId, s]))
        const isFirstSync = existingSnapshots.length === 0

        // Process each book
        for (const ub of userBooks) {
          const bookId = String(ub.book.id)
          const existing = snapshotMap.get(bookId)
          const bookTitle = ub.book.title || null
          const bookAuthor = ub.book.cached_contributors?.[0]?.author?.name || null
          const bookCoverUrl = extractCoverUrl(ub.book.cached_image)
          const read = ub.user_book_reads?.[0]
          const progressPct = read?.progress != null ? read.progress : null

          // Detect changes for non-current-user members (skip first sync to avoid flooding)
          if (!isFirstSync && member.id !== user.id && existing) {
            // Status change
            if (existing.statusId !== ub.status_id && ub.status_id) {
              await prisma.activityEvent.create({
                data: {
                  userId: member.id,
                  type: 'status_change',
                  hardcoverBookId: bookId,
                  bookTitle,
                  bookAuthor,
                  bookCoverUrl,
                  value: STATUS_LABELS[ub.status_id] || String(ub.status_id),
                  visibility: 'global',
                }
              }).catch(() => {})
            }

            // Rating change
            if (existing.rating !== ub.rating && ub.rating != null && ub.rating > 0) {
              await prisma.activityEvent.create({
                data: {
                  userId: member.id,
                  type: 'rating',
                  hardcoverBookId: bookId,
                  bookTitle,
                  bookAuthor,
                  bookCoverUrl,
                  value: `${ub.rating}`,
                  visibility: 'global',
                }
              }).catch(() => {})
            }
          }

          // Upsert snapshot
          await prisma.snapshot.upsert({
            where: {
              userId_hardcoverBookId: {
                userId: member.id,
                hardcoverBookId: bookId,
              }
            },
            create: {
              userId: member.id,
              type: 'user_book',
              hardcoverBookId: bookId,
              statusId: ub.status_id,
              rating: ub.rating ?? null,
              progressPct,
              bookTitle,
              bookAuthor,
              bookCoverUrl,
            },
            update: {
              statusId: ub.status_id,
              rating: ub.rating ?? null,
              progressPct,
              bookTitle,
              bookAuthor,
              bookCoverUrl,
              updatedAt: new Date(),
            }
          })
        }

        refreshedCount++
      } catch (err) {
        console.error(`Snapshot refresh failed for member ${member.id}:`, err)
      }
    }

    return NextResponse.json({ data: { refreshed: refreshedCount } })
  } catch (error) {
    console.error('Snapshot refresh error:', error)
    return NextResponse.json({ error: 'Failed to refresh snapshots' }, { status: 500 })
  }
}
