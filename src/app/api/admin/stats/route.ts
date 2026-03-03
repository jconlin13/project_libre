import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [userCount, householdCount, articleCount, recommendationCount, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.household.count(),
      prisma.article.count(),
      prisma.recommendation.count(),
      prisma.activityEvent.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ])

    return NextResponse.json({
      data: {
        userCount,
        householdCount,
        articleCount,
        recommendationCount,
        activeUsersLast30Days: activeUsers.length,
      },
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
