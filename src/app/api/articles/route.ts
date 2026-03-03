import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { extractOGMetadata } from '@/lib/og-metadata'
import { generateArticleTags } from '@/lib/article-tagger'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')
    const search = searchParams.get('search')
    const saved = searchParams.get('saved') === 'true'
    const mine = searchParams.get('mine') === 'true'
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined

    // Get household member IDs
    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { householdId: true },
    })
    const householdIds = memberships.map(m => m.householdId)
    const allMembers = await prisma.householdMember.findMany({
      where: { householdId: { in: householdIds } },
      select: { userId: true },
    })
    const memberIds = [...new Set(allMembers.map(m => m.userId))]

    // If no household, only show own articles
    const userFilter = mine
      ? { userId: user.id }
      : { userId: { in: memberIds.length > 0 ? memberIds : [user.id] } }

    const articles = await prisma.article.findMany({
      where: {
        ...userFilter,
        ...(search ? {
          OR: [
            { title: { contains: search } },
            { description: { contains: search } },
          ],
        } : {}),
        ...(tag ? { tags: { contains: tag } } : {}),
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        articleSaves: { where: { userId: user.id } },
        articleRecommendations: {
          where: { toUserId: user.id },
          include: {
            fromUser: { select: { name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: limit } : {}),
    })

    let result = articles.map(a => ({
      id: a.id,
      url: a.url,
      title: a.title,
      description: a.description,
      source: a.source,
      imageUrl: a.imageUrl,
      tags: JSON.parse(a.tags) as string[],
      note: a.note,
      createdAt: a.createdAt,
      user: a.user,
      isSaved: a.articleSaves.length > 0,
      isRecommendedToMe: a.articleRecommendations.length > 0,
      recommendationNote: a.articleRecommendations[0]?.note ?? null,
      recommendedBy: a.articleRecommendations[0]?.fromUser ?? null,
    }))

    // Filter to saved articles if requested
    if (saved) {
      result = result.filter(a => a.isSaved)
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Articles GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    let { url, title, description, source, imageUrl, note } = body

    // Auto-populate from URL if provided without title
    if (url && !title) {
      const og = await extractOGMetadata(url)
      title = og.title || url
      description = description || og.description
      imageUrl = imageUrl || og.imageUrl
      source = source || og.source
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Extract source from URL if not provided
    if (!source && url) {
      try {
        source = new URL(url).hostname.replace(/^www\./, '')
      } catch { /* ignore */ }
    }

    const article = await prisma.article.create({
      data: {
        userId: user.id,
        url: url || null,
        title,
        description: description || null,
        source: source || null,
        imageUrl: imageUrl || null,
        note: note || null,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    // Create activity event
    await prisma.activityEvent.create({
      data: {
        userId: user.id,
        type: 'article_shared',
        bookTitle: title, // Reuse bookTitle for article title
        bookAuthor: source || null, // Reuse bookAuthor for source
        bookCoverUrl: imageUrl || null,
        visibility: 'global',
      },
    })

    // Fire-and-forget LLM tagging
    generateArticleTags(title, description).then(async (tags) => {
      if (tags.length > 0) {
        await prisma.article.update({
          where: { id: article.id },
          data: { tags: JSON.stringify(tags) },
        })
      }
    }).catch(console.error)

    return NextResponse.json({
      data: {
        ...article,
        tags: [] as string[],
        isSaved: false,
        isRecommendedToMe: false,
        recommendationNote: null,
        recommendedBy: null,
      },
    })
  } catch (error) {
    console.error('Articles POST error:', error)
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Article ID required' }, { status: 400 })
    }

    const article = await prisma.article.findUnique({ where: { id } })
    if (!article || article.userId !== user.id) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 })
    }

    await prisma.article.delete({ where: { id } })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('Articles DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }
}
