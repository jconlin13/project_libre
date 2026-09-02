import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { STATUS_READ, STATUS_READING, toMemberSummary } from '@/lib/group-data'

export const dynamic = 'force-dynamic'

// Index of the caller's groups with enough summary data to render cards.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      include: {
        household: {
          include: { members: { include: { user: true } } }
        }
      },
      orderBy: { household: { createdAt: 'asc' } },
    })

    if (memberships.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const allMemberIds = [...new Set(
      memberships.flatMap(m => m.household.members.map(hm => hm.userId))
    )]

    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const [finishedThisYear, currentlyReading] = await Promise.all([
      prisma.snapshot.findMany({
        where: { userId: { in: allMemberIds }, statusId: STATUS_READ, lastReadDate: { gte: yearStart } },
        select: { userId: true },
      }),
      prisma.snapshot.findMany({
        where: { userId: { in: allMemberIds }, statusId: STATUS_READING },
        select: { userId: true },
      }),
    ])

    const finishedByUser = new Map<string, number>()
    for (const s of finishedThisYear) {
      finishedByUser.set(s.userId, (finishedByUser.get(s.userId) || 0) + 1)
    }
    const readingByUser = new Map<string, number>()
    for (const s of currentlyReading) {
      readingByUser.set(s.userId, (readingByUser.get(s.userId) || 0) + 1)
    }

    const groups = memberships.map(m => {
      const memberIds = m.household.members.map(hm => hm.userId)
      return {
        id: m.household.id,
        name: m.household.name,
        inviteCode: m.household.inviteCode,
        myRole: m.role,
        memberCount: memberIds.length,
        booksThisYear: memberIds.reduce((sum, id) => sum + (finishedByUser.get(id) || 0), 0),
        readingNow: memberIds.reduce((sum, id) => sum + (readingByUser.get(id) || 0), 0),
        members: m.household.members.map(hm => ({
          ...toMemberSummary(hm.user),
          role: hm.role,
        })),
      }
    })

    return NextResponse.json({ data: groups })
  } catch (error) {
    console.error('Groups index error:', error)
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}
