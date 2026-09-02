import { NextResponse } from 'next/server'
import { getCurrentUser, getHouseholdMembers } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateDisplayScores, type RankingEntry } from '@/lib/ranking'

const LOVED_THRESHOLD = 3.5
const MAX_RESULTS = 10

// Top-ranked books from other household members that the caller hasn't read,
// shelved, or ranked. Display scores are normalized per member (0.5-5.0), so
// they're comparable across people with different-sized libraries.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const members = await getHouseholdMembers(user.id)
    if (members.length === 0) {
      return NextResponse.json({ data: [] })
    }
    const memberIds = members.map(m => m.id)
    const memberById = new Map(members.map(m => [m.id, m]))

    // Books the caller already has any relationship with (any status, or ranked)
    const [mySnapshots, myRankings] = await Promise.all([
      prisma.snapshot.findMany({
        where: { userId: user.id },
        select: { hardcoverBookId: true }
      }),
      prisma.bookRanking.findMany({
        where: { userId: user.id },
        select: { hardcoverBookId: true }
      }),
    ])
    const excluded = new Set([
      ...mySnapshots.map(s => s.hardcoverBookId),
      ...myRankings.map(r => r.hardcoverBookId),
    ])

    // All other members' rankings, grouped per member so each member's
    // display scores are normalized against their own library
    const rankings = await prisma.bookRanking.findMany({
      where: { userId: { in: memberIds } },
    })

    const byMember = new Map<string, typeof rankings>()
    for (const r of rankings) {
      const list = byMember.get(r.userId) || []
      list.push(r)
      byMember.set(r.userId, list)
    }

    const byBook = new Map<string, {
      hardcoverBookId: string
      bookTitle: string | null
      bookAuthor: string | null
      bookCoverUrl: string | null
      topScore: number
      lovedBy: Array<{ userId: string; name: string; avatarUrl: string | null; avatarIcon: string | null; displayScore: number; rank: number; outOf: number }>
    }>()

    for (const [memberId, memberRankings] of byMember) {
      const member = memberById.get(memberId)
      if (!member) continue

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

      // Rank position within this member's library (1 = their favorite)
      const sorted = [...memberRankings].sort((a, b) =>
        (scores.get(b.hardcoverBookId) ?? 0) - (scores.get(a.hardcoverBookId) ?? 0)
      )
      const rankOf = new Map(sorted.map((r, i) => [r.hardcoverBookId, i + 1]))

      for (const r of memberRankings) {
        if (excluded.has(r.hardcoverBookId)) continue
        const score = scores.get(r.hardcoverBookId)
        if (score == null || score < LOVED_THRESHOLD) continue

        let entry = byBook.get(r.hardcoverBookId)
        if (!entry) {
          entry = {
            hardcoverBookId: r.hardcoverBookId,
            bookTitle: r.bookTitle,
            bookAuthor: r.bookAuthor,
            bookCoverUrl: r.bookCoverUrl,
            topScore: 0,
            lovedBy: [],
          }
          byBook.set(r.hardcoverBookId, entry)
        }
        entry.topScore = Math.max(entry.topScore, score)
        entry.lovedBy.push({
          userId: member.id,
          name: member.name,
          avatarUrl: member.avatarUrl,
          avatarIcon: member.avatarIcon,
          displayScore: score,
          rank: rankOf.get(r.hardcoverBookId) ?? 0,
          outOf: memberRankings.length,
        })
      }
    }

    const favorites = [...byBook.values()]
      .sort((a, b) => {
        // More lovers first, then by best score
        if (a.lovedBy.length !== b.lovedBy.length) return b.lovedBy.length - a.lovedBy.length
        return b.topScore - a.topScore
      })
      .slice(0, MAX_RESULTS)

    return NextResponse.json({ data: favorites })
  } catch (error) {
    console.error('Household favorites error:', error)
    return NextResponse.json({ error: 'Failed to fetch group favorites' }, { status: 500 })
  }
}
