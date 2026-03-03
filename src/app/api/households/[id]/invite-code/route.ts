import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, verifyHouseholdAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { logAudit } from '@/lib/audit'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: householdId } = await params
    const result = await verifyHouseholdAdmin(user.id, householdId)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const newCode = crypto.randomBytes(4).toString('hex').toUpperCase()

    await prisma.household.update({
      where: { id: householdId },
      data: { inviteCode: newCode },
    })

    await logAudit({ userId: user.id, action: 'invite_regen', targetId: householdId })

    return NextResponse.json({ data: { inviteCode: newCode } })
  } catch (error) {
    console.error('Invite code regen error:', error)
    return NextResponse.json({ error: 'Failed to regenerate invite code' }, { status: 500 })
  }
}
