import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ALLOWED_AVATAR_ICONS } from '@/lib/avatar-icons'
import { logAudit } from '@/lib/audit'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        avatarIcon: user.avatarIcon,
        hardcoverConnected: !!user.hardcoverApiToken,
        hardcoverUsername: user.hardcoverUsername,
        households: user.householdMembers.map(m => ({
          id: m.household.id,
          name: m.household.name,
          role: m.role,
          memberCount: m.household.members.length,
        })),
      }
    })
  } catch (error) {
    console.error('User error:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, email, avatarIcon } = await request.json()

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
      }
      const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
      if (existing && existing.id !== user.id) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
    }

    if (avatarIcon !== undefined && avatarIcon !== null) {
      if (!ALLOWED_AVATAR_ICONS.includes(avatarIcon)) {
        return NextResponse.json({ error: 'Invalid avatar icon' }, { status: 400 })
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: email.trim().toLowerCase() }),
        ...(avatarIcon !== undefined && { avatarIcon }),
      },
    })

    await logAudit({
      userId: user.id,
      action: 'profile_update',
      details: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: email.trim().toLowerCase() }),
        ...(avatarIcon !== undefined && { avatarIcon }),
      },
    })

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        avatarIcon: updated.avatarIcon,
      }
    })
  } catch (error) {
    console.error('User update error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
