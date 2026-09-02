import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getScoredBooksForMembers, getGroupRole, toMemberSummary } from '@/lib/group-data'

export const dynamic = 'force-dynamic'

const LOVED_THRESHOLD = 3.5
const MAX_RESULTS = 10

// Top-ranked books from other group members that the caller hasn't read,
// shelved, or ranked. Display scores are normalized per member (0.5-5.0), so
// they're comparable across people with different-sized libraries.
// Pass ?groupId= to scope to a single group.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const groupId = new URL(request.url).searchParams.get('groupId')
    if (groupId && !(await getGroupRole(user.id, groupId))) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { householdId: true },
    })
    const householdIds = memberships.map(m => m.householdId)
    if (householdIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const allMembers = await prisma.householdMember.findMany({
      where: { householdId: groupId ? groupId : { in: householdIds } },
      include: { user: true },
    })
    const others = [...new Map(
      allMembers.filter(m => m.userId !== user.id).map(m => [m.userId, m.user])
    ).values()]
    if (others.length === 0) {
      return NextResponse.json({ data: [] })
    }
    const memberById = new Map(others.map(u => [u.id, u]))

    // Books the caller already has any relationship with (any status, or ranked)
    const [mySnapshots, myRankings] = await Promise.all([
      prisma.snapshot.findMany({ where: { userId: user.id }, select: { hardcoverBookId: true } }),
      prisma.bookRanking.findMany({ where: { userId: user.id }, select: { hardcoverBookId: true } }),
    ])
    const excluded = new Set([
      ...mySnapshots.map(s => s.hardcoverBookId),
      ...myRankings.map(r => r.hardcoverBookId),
    ])

    const scored = await getScoredBooksForMembers(others.map(u => u.id))

    const byBook = new Map<string, {
      hardcoverBookId: string
      bookTitle: string | null
      bookAuthor: string | null
      bookCoverUrl: string | null
      topScore: number
      lovedBy: Array<ReturnType<typeof toMemberSummary> & { displayScore: number; rank: number; outOf: number }>
    }>()

    for (const b of scored) {
      if (excluded.has(b.hardcoverBookId)) continue
      if (b.displayScore < LOVED_THRESHOLD) continue
      const member = memberById.get(b.userId)
      if (!member) continue

      let entry = byBook.get(b.hardcoverBookId)
      if (!entry) {
        entry = {
          hardcoverBookId: b.hardcoverBookId,
          bookTitle: b.bookTitle,
          bookAuthor: b.bookAuthor,
          bookCoverUrl: b.bookCoverUrl,
          topScore: 0,
          lovedBy: [],
        }
        byBook.set(b.hardcoverBookId, entry)
      }
      entry.topScore = Math.max(entry.topScore, b.displayScore)
      entry.lovedBy.push({
        ...toMemberSummary(member),
        displayScore: b.displayScore,
        rank: b.rank,
        outOf: b.outOf,
      })
    }

    const favorites = [...byBook.values()]
      .sort((a, b) => {
        if (a.lovedBy.length !== b.lovedBy.length) return b.lovedBy.length - a.lovedBy.length
        return b.topScore - a.topScore
      })
      .slice(0, MAX_RESULTS)

    return NextResponse.json({ data: favorites })
  } catch (error) {
    console.error('Group favorites error:', error)
    return NextResponse.json({ error: 'Failed to fetch group favorites' }, { status: 500 })
  }
}
