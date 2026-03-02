import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookId = new URL(request.url).searchParams.get('bookId')
    if (!bookId) {
      return NextResponse.json({ error: 'bookId required' }, { status: 400 })
    }

    // Get household member IDs
    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { householdId: true }
    })
    const householdIds = memberships.map(m => m.householdId)

    if (householdIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const allMembers = await prisma.householdMember.findMany({
      where: { householdId: { in: householdIds } },
      select: { userId: true }
    })
    const memberIds = [...new Set(allMembers.map(m => m.userId))]

    // Query snapshots for this book across household members (exclude current user)
    const snapshots = await prisma.snapshot.findMany({
      where: {
        hardcoverBookId: bookId,
        userId: { in: memberIds.filter(id => id !== user.id) },
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } }
      }
    })

    const readers = snapshots.map(s => ({
      userId: s.userId,
      name: s.user.name,
      avatarUrl: s.user.avatarUrl,
      statusId: s.statusId,
      rating: s.rating,
      progressPct: s.progressPct,
    }))

    return NextResponse.json({ data: readers })
  } catch (error) {
    console.error('Readers error:', error)
    return NextResponse.json({ error: 'Failed to fetch readers' }, { status: 500 })
  }
}
