import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookId = request.nextUrl.searchParams.get('bookId')
    if (!bookId) {
      return NextResponse.json({ error: 'bookId required' }, { status: 400 })
    }

    const record = await prisma.userBookMediaType.findUnique({
      where: { userId_hardcoverBookId: { userId: user.id, hardcoverBookId: bookId } },
    })

    return NextResponse.json({ data: { mediaType: record?.mediaType ?? 'book' } })
  } catch (error) {
    console.error('Media type GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch media type' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { hardcoverBookId, mediaType } = await request.json()
    if (!hardcoverBookId || !mediaType) {
      return NextResponse.json({ error: 'hardcoverBookId and mediaType required' }, { status: 400 })
    }

    const validTypes = ['book', 'ebook', 'audiobook']
    if (!validTypes.includes(mediaType)) {
      return NextResponse.json({ error: `mediaType must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    // If setting back to default "book", delete the record instead of storing it
    if (mediaType === 'book') {
      await prisma.userBookMediaType.deleteMany({
        where: { userId: user.id, hardcoverBookId: String(hardcoverBookId) },
      })
      return NextResponse.json({ data: { mediaType: 'book' } })
    }

    const record = await prisma.userBookMediaType.upsert({
      where: { userId_hardcoverBookId: { userId: user.id, hardcoverBookId: String(hardcoverBookId) } },
      create: { userId: user.id, hardcoverBookId: String(hardcoverBookId), mediaType },
      update: { mediaType },
    })

    return NextResponse.json({ data: { mediaType: record.mediaType } })
  } catch (error) {
    console.error('Media type PUT error:', error)
    return NextResponse.json({ error: 'Failed to update media type' }, { status: 500 })
  }
}
