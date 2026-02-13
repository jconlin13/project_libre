import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { inviteCode } = await request.json()
    if (!inviteCode || typeof inviteCode !== 'string') {
      return NextResponse.json({ error: 'Invite code required' }, { status: 400 })
    }

    const household = await prisma.household.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
    })

    if (!household) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
    }

    // Check if already a member
    const existing = await prisma.householdMember.findUnique({
      where: {
        householdId_userId: {
          householdId: household.id,
          userId: user.id,
        }
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Already a member' }, { status: 400 })
    }

    await prisma.householdMember.create({
      data: {
        householdId: household.id,
        userId: user.id,
        role: 'member',
      }
    })

    return NextResponse.json({ data: { householdName: household.name } })
  } catch (error) {
    console.error('Join household error:', error)
    return NextResponse.json({ error: 'Failed to join household' }, { status: 500 })
  }
}
