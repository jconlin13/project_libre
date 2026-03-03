import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateArticleTags } from '@/lib/article-tagger'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { articleId } = await request.json()

    if (!articleId) {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 })
    }

    const article = await prisma.article.findUnique({ where: { id: articleId } })
    if (!article || article.userId !== user.id) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 })
    }

    const tags = await generateArticleTags(article.title, article.description)

    await prisma.article.update({
      where: { id: articleId },
      data: { tags: JSON.stringify(tags) },
    })

    return NextResponse.json({ data: { tags } })
  } catch (error) {
    console.error('Article retag error:', error)
    return NextResponse.json({ error: 'Failed to retag article' }, { status: 500 })
  }
}
