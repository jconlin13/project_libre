import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [received, sent] = await Promise.all([
      prisma.articleRecommendation.findMany({
        where: { toUserId: user.id },
        include: {
          fromUser: { select: { id: true, name: true, avatarUrl: true } },
          article: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.articleRecommendation.findMany({
        where: { fromUserId: user.id },
        include: {
          toUser: { select: { id: true, name: true, avatarUrl: true } },
          article: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({ data: { received, sent } })
  } catch (error) {
    console.error('Article recommend GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { articleId, toUserId, note } = await request.json()

    if (!articleId || !toUserId) {
      return NextResponse.json({ error: 'articleId and toUserId are required' }, { status: 400 })
    }

    // Verify recipient is in same household
    const userHouseholds = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { householdId: true },
    })
    const householdIds = userHouseholds.map(m => m.householdId)
    const recipientMembership = await prisma.householdMember.findFirst({
      where: { userId: toUserId, householdId: { in: householdIds } },
    })
    if (!recipientMembership) {
      return NextResponse.json({ error: 'Recipient not in your household' }, { status: 403 })
    }

    // Verify article exists
    const article = await prisma.article.findUnique({ where: { id: articleId } })
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const recommendation = await prisma.articleRecommendation.create({
      data: {
        fromUserId: user.id,
        toUserId,
        articleId,
        note: note || null,
      },
    })

    // Create activity event
    await prisma.activityEvent.create({
      data: {
        userId: user.id,
        type: 'article_recommended',
        bookTitle: article.title,
        bookAuthor: article.source,
        bookCoverUrl: article.imageUrl,
        targetUserId: toUserId,
        note: note || null,
        visibility: 'private',
      },
    })

    return NextResponse.json({ data: recommendation })
  } catch (error) {
    console.error('Article recommend POST error:', error)
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

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
    }

    const validStatuses = ['seen', 'saved', 'dismissed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const recommendation = await prisma.articleRecommendation.findUnique({ where: { id } })
    if (!recommendation || recommendation.toUserId !== user.id) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 })
    }

    const updated = await prisma.articleRecommendation.update({
      where: { id },
      data: { status },
    })

    // If saved, also create an ArticleSave
    if (status === 'saved') {
      await prisma.articleSave.upsert({
        where: {
          userId_articleId: { userId: user.id, articleId: recommendation.articleId },
        },
        create: { userId: user.id, articleId: recommendation.articleId },
        update: {},
      })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Article recommend PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 })
  }
}
