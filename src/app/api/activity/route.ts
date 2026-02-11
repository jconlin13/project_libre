import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    // Fetch recent activity
    const [recommendations, plusOnes] = await Promise.all([
      prisma.recommendation.findMany({
        where: {
          OR: [
            { fromUserId: { in: memberIds } },
            { toUserId: { in: memberIds } },
          ]
        },
        include: { fromUser: true, toUser: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.plusOne.findMany({
        where: { userId: { in: memberIds } },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    // Merge and sort
    const activity = [
      ...recommendations.map(r => ({
        type: 'recommendation' as const,
        id: r.id,
        user: r.fromUser,
        targetUser: r.toUser,
        bookTitle: r.bookTitle,
        bookAuthor: r.bookAuthor,
        bookCoverUrl: r.bookCoverUrl,
        hardcoverBookId: r.hardcoverBookId,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...plusOnes.map(p => ({
        type: 'plus_one' as const,
        id: p.id,
        user: p.user,
        targetUser: null,
        bookTitle: p.bookTitle,
        bookAuthor: p.bookAuthor,
        bookCoverUrl: p.bookCoverUrl,
        hardcoverBookId: p.hardcoverBookId,
        note: null,
        status: null,
        createdAt: p.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 30)

    return NextResponse.json({ data: activity })
  } catch (error) {
    console.error('Activity error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
