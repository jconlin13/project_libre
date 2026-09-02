import { prisma } from '@/lib/prisma'

export interface MergeMetadata {
  title: string
  author: string | null
  coverUrl: string | null
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
export async function migrateBookId(
  userId: string,
  fromId: string,
  toId: string,
  meta: MergeMetadata
) {
  const { title, author, coverUrl } = meta

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
            bookTitle: title,
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
            bookTitle: title,
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
            bookTitle: title,
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
      data: { hardcoverBookId: toId, bookTitle: title, bookAuthor: author },
    })
    await tx.recommendation.updateMany({
      where: { hardcoverBookId: fromId, OR: [{ fromUserId: userId }, { toUserId: userId }] },
      data: { hardcoverBookId: toId, bookTitle: title, bookAuthor: author },
    })
    await tx.activityEvent.updateMany({
      where: { userId, hardcoverBookId: fromId },
      data: { hardcoverBookId: toId, bookTitle: title, bookAuthor: author },
    })
    await tx.bookComparison.updateMany({ where: { userId, winnerBookId: fromId }, data: { winnerBookId: toId } })
    await tx.bookComparison.updateMany({ where: { userId, loserBookId: fromId }, data: { loserBookId: toId } })
  })
}

