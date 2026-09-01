import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Books read this year, per household member and collectively.
// Counts snapshots with status Read whose Hardcover last_read_date falls in
// the current year. Members are returned in alphabetical order — no ranking.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { householdId: true }
    })
    const householdIds = memberships.map(m => m.householdId)
    if (householdIds.length === 0) {
      return NextResponse.json({ data: { year: new Date().getFullYear(), total: 0, members: [] } })
    }

    const allMembers = await prisma.householdMember.findMany({
      where: { householdId: { in: householdIds } },
      include: { user: { select: { id: true, name: true, avatarUrl: true, avatarIcon: true } } }
    })
    const uniqueMembers = [...new Map(allMembers.map(m => [m.userId, m.user])).values()]

    const year = new Date().getFullYear()
    const yearStart = new Date(year, 0, 1)

    const finished = await prisma.snapshot.findMany({
      where: {
        userId: { in: uniqueMembers.map(m => m.id) },
        statusId: 3,
        lastReadDate: { gte: yearStart },
      },
      select: { userId: true }
    })

    const countByUser = new Map<string, number>()
    for (const s of finished) {
      countByUser.set(s.userId, (countByUser.get(s.userId) || 0) + 1)
    }

    const memberCounts = uniqueMembers
      .map(m => ({
        userId: m.id,
        name: m.name,
        avatarUrl: m.avatarUrl,
        avatarIcon: m.avatarIcon,
        count: countByUser.get(m.id) || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      data: {
        year,
        total: finished.length,
        members: memberCounts,
      }
    })
  } catch (error) {
    console.error('Year counts error:', error)
    return NextResponse.json({ error: 'Failed to fetch year counts' }, { status: 500 })
  }
}
