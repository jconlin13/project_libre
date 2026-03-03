import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { confirmEmail } = await request.json()

    if (!confirmEmail || confirmEmail !== user.email) {
      return NextResponse.json({ error: 'Email confirmation does not match' }, { status: 400 })
    }

    // Check if sole admin of any household with remaining members
    const adminMemberships = await prisma.householdMember.findMany({
      where: { userId: user.id, role: 'admin' },
      include: {
        household: {
          include: { members: true }
        }
      }
    })

    for (const membership of adminMemberships) {
      const otherAdmins = membership.household.members.filter(
        m => m.userId !== user.id && m.role === 'admin'
      )
      const otherMembers = membership.household.members.filter(
        m => m.userId !== user.id
      )
      if (otherAdmins.length === 0 && otherMembers.length > 0) {
        return NextResponse.json(
          { error: `You are the only admin of "${membership.household.name}". Promote another member to admin before deleting your account.` },
          { status: 400 }
        )
      }
    }

    // Log before delete (user record will be gone after)
    await logAudit({
      userId: null, // user about to be deleted, use null so FK doesn't break
      action: 'account_delete',
      details: { email: user.email, name: user.name },
    })

    // Delete user — Prisma cascade handles all relations
    await prisma.user.delete({ where: { id: user.id } })

    // Clear session cookie
    const cookieStore = await cookies()
    cookieStore.delete('local-session')

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
