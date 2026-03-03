import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, verifyHouseholdAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: householdId } = await params
    const result = await verifyHouseholdAdmin(user.id, householdId)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { name } = await request.json()
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const updated = await prisma.household.update({
      where: { id: householdId },
      data: { name: name.trim() },
    })

    await logAudit({ userId: user.id, action: 'household_rename', targetId: householdId, details: { newName: name.trim() } })

    return NextResponse.json({ data: { id: updated.id, name: updated.name } })
  } catch (error) {
    console.error('Household update error:', error)
    return NextResponse.json({ error: 'Failed to update household' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: householdId } = await params
    const action = request.nextUrl.searchParams.get('action')

    if (action === 'leave') {
      const membership = await prisma.householdMember.findUnique({
        where: { householdId_userId: { householdId, userId: user.id } },
      })
      if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 404 })

      // Check if sole admin with other members remaining
      if (membership.role === 'admin') {
        const otherAdmins = await prisma.householdMember.count({
          where: { householdId, role: 'admin', userId: { not: user.id } },
        })
        const otherMembers = await prisma.householdMember.count({
          where: { householdId, userId: { not: user.id } },
        })
        if (otherAdmins === 0 && otherMembers > 0) {
          return NextResponse.json(
            { error: 'You are the only admin. Promote another member to admin before leaving.' },
            { status: 400 }
          )
        }
      }

      await prisma.householdMember.delete({
        where: { householdId_userId: { householdId, userId: user.id } },
      })

      // If no members left, delete the household
      const remaining = await prisma.householdMember.count({ where: { householdId } })
      if (remaining === 0) {
        await prisma.household.delete({ where: { id: householdId } })
      }

      await logAudit({ userId: user.id, action: 'household_leave', targetId: householdId })

      return NextResponse.json({ data: { left: true } })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Household delete error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
