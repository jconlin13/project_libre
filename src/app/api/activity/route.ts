import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ?groupId= scopes the feed to one group; omitted, it spans every group
    // the caller belongs to (plus their own private events).
    const groupId = new URL(request.url).searchParams.get('groupId')
    const limitParam = Number(new URL(request.url).searchParams.get('limit'))
    const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 30

    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { householdId: true }
    })
    const householdIds = memberships.map(m => m.householdId)

    if (groupId && !householdIds.includes(groupId)) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    const allMembers = await prisma.householdMember.findMany({
      where: { householdId: groupId ? groupId : { in: householdIds } },
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
      take,
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
      mediaType: e.mediaType,
      createdAt: e.createdAt,
    }))

    return NextResponse.json({ data: activity })
  } catch (error) {
    console.error('Activity error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
