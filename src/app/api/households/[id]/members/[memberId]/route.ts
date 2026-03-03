import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, verifyHouseholdAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: householdId, memberId } = await params
    const result = await verifyHouseholdAdmin(user.id, householdId)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { role } = await request.json()
    if (role !== 'admin' && role !== 'member') {
      return NextResponse.json({ error: 'Role must be "admin" or "member"' }, { status: 400 })
    }

    // Find the target membership
    const targetMembership = await prisma.householdMember.findFirst({
      where: { householdId, user: { id: memberId } },
    })
    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found in this household' }, { status: 404 })
    }

    // Can't demote yourself if you're the last admin
    if (memberId === user.id && role === 'member') {
      const adminCount = await prisma.householdMember.count({
        where: { householdId, role: 'admin' },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote yourself — you are the only admin' },
          { status: 400 }
        )
      }
    }

    await prisma.householdMember.update({
      where: { id: targetMembership.id },
      data: { role },
    })

    await logAudit({ userId: user.id, action: 'role_change', targetId: memberId, details: { householdId, newRole: role } })

    return NextResponse.json({ data: { memberId, role } })
  } catch (error) {
    console.error('Member role change error:', error)
    return NextResponse.json({ error: 'Failed to change role' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: householdId, memberId } = await params
    const result = await verifyHouseholdAdmin(user.id, householdId)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    if (memberId === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself — use leave instead' }, { status: 400 })
    }

    const targetMembership = await prisma.householdMember.findFirst({
      where: { householdId, user: { id: memberId } },
    })
    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found in this household' }, { status: 404 })
    }

    await prisma.householdMember.delete({
      where: { id: targetMembership.id },
    })

    await logAudit({ userId: user.id, action: 'member_remove', targetId: memberId, details: { householdId } })

    return NextResponse.json({ data: { removed: true } })
  } catch (error) {
    console.error('Member remove error:', error)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
