import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    // Toggle: if saved, unsave; if not saved, save
    const existing = await prisma.articleSave.findUnique({
      where: { userId_articleId: { userId: user.id, articleId } },
    })

    if (existing) {
      await prisma.articleSave.delete({ where: { id: existing.id } })
      return NextResponse.json({ data: { saved: false } })
    }

    await prisma.articleSave.create({
      data: { userId: user.id, articleId },
    })

    return NextResponse.json({ data: { saved: true } })
  } catch (error) {
    console.error('Article save error:', error)
    return NextResponse.json({ error: 'Failed to toggle save' }, { status: 500 })
  }
}
