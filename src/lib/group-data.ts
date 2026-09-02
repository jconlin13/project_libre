import { prisma } from '@/lib/prisma'
import { calculateDisplayScores, type RankingEntry } from '@/lib/ranking'

export const STATUS_WANT = 1
export const STATUS_READING = 2
export const STATUS_READ = 3

/** Member ids for a group. */
export async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const members = await prisma.householdMember.findMany({
    where: { householdId: groupId },
    select: { userId: true },
  })
  return [...new Set(members.map(m => m.userId))]
}

/** Verify the user belongs to the group; returns their role or null. */
export async function getGroupRole(userId: string, groupId: string): Promise<string | null> {
  const membership = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId: groupId, userId } },
    select: { role: true },
  })
  return membership?.role ?? null
}

export interface ScoredBook {
  hardcoverBookId: string
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
  displayScore: number
  rank: number
  outOf: number
  userId: string
}

/**
 * Display scores for every ranked book across the given members.
 * Each member's scores are normalized against their own library (see
 * calculateDisplayScores), so scores are comparable between people.
 */
export async function getScoredBooksForMembers(memberIds: string[]): Promise<ScoredBook[]> {
  const rankings = await prisma.bookRanking.findMany({
    where: { userId: { in: memberIds } },
  })

  const byMember = new Map<string, typeof rankings>()
  for (const r of rankings) {
    const list = byMember.get(r.userId) || []
    list.push(r)
    byMember.set(r.userId, list)
  }

  const out: ScoredBook[] = []
  for (const [userId, memberRankings] of byMember) {
    const entries: RankingEntry[] = memberRankings.map(r => ({
      hardcoverBookId: r.hardcoverBookId,
      eloScore: r.eloScore,
      manualOverride: r.manualOverride,
      comparisonCount: r.comparisonCount,
      bookTitle: r.bookTitle,
      bookAuthor: r.bookAuthor,
      bookCoverUrl: r.bookCoverUrl,
    }))
    const scores = calculateDisplayScores(entries)

    const sorted = [...memberRankings].sort((a, b) =>
      (scores.get(b.hardcoverBookId) ?? 0) - (scores.get(a.hardcoverBookId) ?? 0)
    )
    const rankOf = new Map(sorted.map((r, i) => [r.hardcoverBookId, i + 1]))

    for (const r of memberRankings) {
      const score = scores.get(r.hardcoverBookId)
      if (score == null) continue
      out.push({
        hardcoverBookId: r.hardcoverBookId,
        bookTitle: r.bookTitle,
        bookAuthor: r.bookAuthor,
        bookCoverUrl: r.bookCoverUrl,
        displayScore: score,
        rank: rankOf.get(r.hardcoverBookId) ?? 0,
        outOf: memberRankings.length,
        userId,
      })
    }
  }
  return out
}

export interface MemberSummary {
  id: string
  name: string
  avatarUrl: string | null
  avatarIcon: string | null
}

/** Shape a user record down to the fields the group views render. */
export function toMemberSummary(u: {
  id: string
  name: string
  avatarUrl: string | null
  avatarIcon: string | null
}): MemberSummary {
  return { id: u.id, name: u.name, avatarUrl: u.avatarUrl, avatarIcon: u.avatarIcon }
}
