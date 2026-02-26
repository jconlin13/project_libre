import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get household member IDs
    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { householdId: true }
    })
    const householdIds = memberships.map(m => m.householdId)

    const allMembers = await prisma.householdMember.findMany({
      where: { householdId: { in: householdIds } },
      select: { userId: true }
    })
    const memberIds = [...new Set(allMembers.map(m => m.userId))]

    // Fetch from unified ActivityEvent table with visibility filtering:
    // - Global events: visible to all household members
    // - Private events: only visible to sender or recipient
    const events = await prisma.activityEvent.findMany({
      where: {
        OR: [
          { userId: { in: memberIds }, visibility: 'global' },
          { userId: user.id, visibility: 'private' },
          { targetUserId: user.id, visibility: 'private' },
        ],
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        targetUser: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    // Normalize to response shape
    const activity = events.map(e => ({
      type: e.type,
      id: e.id,
      user: e.user,
      targetUser: e.targetUser,
      bookTitle: e.bookTitle,
      bookAuthor: e.bookAuthor,
      bookCoverUrl: e.bookCoverUrl,
      hardcoverBookId: e.hardcoverBookId,
      value: e.value,
      note: e.note,
      createdAt: e.createdAt,
    }))

    return NextResponse.json({ data: activity })
  } catch (error) {
    console.error('Activity error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
