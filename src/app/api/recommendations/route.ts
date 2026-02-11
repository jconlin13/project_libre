import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getHouseholdMembers } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [received, sent] = await Promise.all([
      prisma.recommendation.findMany({
        where: { toUserId: user.id },
        include: { fromUser: true, toUser: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.recommendation.findMany({
        where: { fromUserId: user.id },
        include: { fromUser: true, toUser: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({ data: { received, sent } })
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { toUserId, hardcoverBookId, bookTitle, bookAuthor, bookCoverUrl, note } = await request.json()

    if (!toUserId || !hardcoverBookId) {
      return NextResponse.json({ error: 'toUserId and hardcoverBookId required' }, { status: 400 })
    }

    // Verify recipient is in same household
    const householdMembers = await getHouseholdMembers(user.id)
    const isHouseholdMember = householdMembers.some(m => m.id === toUserId)

    if (!isHouseholdMember) {
      return NextResponse.json({ error: 'Recipient not in your household' }, { status: 403 })
    }

    const recommendation = await prisma.recommendation.create({
      data: {
        fromUserId: user.id,
        toUserId,
        hardcoverBookId: String(hardcoverBookId),
        bookTitle,
        bookAuthor,
        bookCoverUrl,
        note,
      },
      include: { fromUser: true, toUser: true },
    })

    return NextResponse.json({ data: recommendation })
  } catch (error) {
    console.error('Create recommendation error:', error)
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
    if (!id || !['accepted', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const recommendation = await prisma.recommendation.findUnique({ where: { id } })
    if (!recommendation || recommendation.toUserId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.recommendation.update({
      where: { id },
      data: { status },
      include: { fromUser: true, toUser: true },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Update recommendation error:', error)
    return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 })
  }
}
