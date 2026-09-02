import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getHouseholdMembers } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getScoredBooksForMembers, toMemberSummary, STATUS_WANT, STATUS_READING, STATUS_READ } from '@/lib/group-data'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [received, sent] = await Promise.all([
      prisma.recommendation.findMany({
        where: { toUserId: user.id },
        include: { fromUser: true, toUser: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.recommendation.findMany({
        where: { fromUserId: user.id },
        include: { fromUser: true, toUser: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // Enrich received recommendations with "why you should read this" context:
    // how the sender themselves ranked it, and who else in the group has it.
    const groupMembers = await getHouseholdMembers(user.id)
    const memberById = new Map(groupMembers.map(m => [m.id, m]))
    const contextIds = [...new Set([user.id, ...groupMembers.map(m => m.id)])]
    const bookIds = [...new Set(received.map(r => r.hardcoverBookId))]

    let enrichedReceived = received as Array<(typeof received)[number] & {
      senderRating?: { displayScore: number; rank: number; outOf: number } | null
      alsoHave?: Array<{ user: ReturnType<typeof toMemberSummary>; statusId: number | null; rating: number | null }>
    }>

    if (bookIds.length > 0) {
      const [scored, snapshots] = await Promise.all([
        getScoredBooksForMembers(contextIds),
        prisma.snapshot.findMany({
          where: { userId: { in: contextIds }, hardcoverBookId: { in: bookIds } },
        }),
      ])

      const scoreKey = (userId: string, bookId: string) => `${userId}:${bookId}`
      const scoreMap = new Map(scored.map(s => [scoreKey(s.userId, s.hardcoverBookId), s]))

      enrichedReceived = received.map(rec => {
        const senderScore = scoreMap.get(scoreKey(rec.fromUserId, rec.hardcoverBookId))

        const alsoHave = snapshots
          .filter(s =>
            s.hardcoverBookId === rec.hardcoverBookId &&
            s.userId !== user.id &&
            s.userId !== rec.fromUserId &&
            s.statusId != null &&
            [STATUS_WANT, STATUS_READING, STATUS_READ].includes(s.statusId)
          )
          .map(s => {
            const u = memberById.get(s.userId)
            return u ? { user: toMemberSummary(u), statusId: s.statusId, rating: s.rating } : null
          })
          .filter((x): x is NonNullable<typeof x> => !!x)
          // Read first, then reading, then want-to-read
          .sort((a, b) => (b.statusId ?? 0) - (a.statusId ?? 0))

        return {
          ...rec,
          senderRating: senderScore
            ? { displayScore: senderScore.displayScore, rank: senderScore.rank, outOf: senderScore.outOf }
            : null,
          alsoHave,
        }
      })
    }

    return NextResponse.json({ data: { received: enrichedReceived, sent } })
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { toUserId, hardcoverBookId, bookTitle, bookAuthor, bookCoverUrl, note } = await request.json()

    if (!toUserId || !hardcoverBookId) {
      return NextResponse.json({ error: 'toUserId and hardcoverBookId required' }, { status: 400 })
    }

    // Verify recipient is in same household
    const householdMembers = await getHouseholdMembers(user.id)
    const isHouseholdMember = householdMembers.some(m => m.id === toUserId)

    if (!isHouseholdMember) {
      return NextResponse.json({ error: 'Recipient not in your group' }, { status: 403 })
    }

    const recommendation = await prisma.recommendation.create({
      data: {
        fromUserId: user.id,
        toUserId,
        hardcoverBookId: String(hardcoverBookId),
        bookTitle,
        bookAuthor,
        bookCoverUrl,
        note,
      },
      include: { fromUser: true, toUser: true },
    })

    // Write activity event (private — only sender + recipient see it)
    await prisma.activityEvent.create({
      data: {
        userId: user.id,
        type: 'recommendation',
        hardcoverBookId: String(hardcoverBookId),
        bookTitle: bookTitle || null,
        bookAuthor: bookAuthor || null,
        bookCoverUrl: bookCoverUrl || null,
        targetUserId: toUserId,
        note: note || null,
        visibility: 'private',
      },
    }).catch((e) => console.error('Activity event write failed:', e))

    return NextResponse.json({ data: recommendation })
  } catch (error) {
    console.error('Create recommendation error:', error)
    return NextResponse.json({ error: 'Failed to create recommendation' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, status } = await request.json()
    if (!id || !['accepted', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const recommendation = await prisma.recommendation.findUnique({ where: { id } })
    if (!recommendation || recommendation.toUserId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.recommendation.update({
      where: { id },
      data: { status },
      include: { fromUser: true, toUser: true },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Update recommendation error:', error)
    return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 })
  }
}
