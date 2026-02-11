import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      include: {
        household: {
          include: {
            members: {
              include: { user: true }
            }
          }
        }
      }
    })

    const households = memberships.map(m => ({
      ...m.household,
      role: m.role,
      members: m.household.members.map(hm => ({
        id: hm.user.id,
        name: hm.user.name,
        avatarUrl: hm.user.avatarUrl,
        role: hm.role,
        hardcoverConnected: !!hm.user.hardcoverApiToken,
        hardcoverUsername: hm.user.hardcoverUsername,
      }))
    }))

    return NextResponse.json({ data: households })
  } catch (error) {
    console.error('Households error:', error)
    return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name } = await request.json()
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }

    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase()

    const household = await prisma.household.create({
      data: {
        name,
        inviteCode,
        members: {
          create: {
            userId: user.id,
            role: 'admin',
          }
        }
      },
      include: {
        members: {
          include: { user: true }
        }
      }
    })

    return NextResponse.json({ data: household })
  } catch (error) {
    console.error('Create household error:', error)
    return NextResponse.json({ error: 'Failed to create household' }, { status: 500 })
  }
}
