import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plusOnes = await prisma.plusOne.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: plusOnes })
  } catch (error) {
    console.error('Plus ones error:', error)
    return NextResponse.json({ error: 'Failed to fetch plus ones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { hardcoverBookId, bookTitle, bookAuthor, bookCoverUrl } = await request.json()

    if (!hardcoverBookId) {
      return NextResponse.json({ error: 'hardcoverBookId required' }, { status: 400 })
    }

    const plusOne = await prisma.plusOne.upsert({
      where: {
        userId_hardcoverBookId: {
          userId: user.id,
          hardcoverBookId: String(hardcoverBookId),
        }
      },
      update: {},
      create: {
        userId: user.id,
        hardcoverBookId: String(hardcoverBookId),
        bookTitle,
        bookAuthor,
        bookCoverUrl,
      },
    })

    return NextResponse.json({ data: plusOne })
  } catch (error) {
    console.error('Plus one error:', error)
    return NextResponse.json({ error: 'Failed to add plus one' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const hardcoverBookId = searchParams.get('bookId')
    if (!hardcoverBookId) {
      return NextResponse.json({ error: 'bookId required' }, { status: 400 })
    }

    const result = await prisma.plusOne.deleteMany({
      where: {
        userId: user.id,
        hardcoverBookId,
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Plus one not found' }, { status: 404 })
    }

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('Remove plus one error:', error)
    return NextResponse.json({ error: 'Failed to remove plus one' }, { status: 500 })
  }
}
