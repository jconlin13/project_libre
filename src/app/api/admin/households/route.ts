import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const households = await prisma.household.findMany({
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarIcon: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      data: households.map(h => ({
        id: h.id,
        name: h.name,
        inviteCode: h.inviteCode,
        createdAt: h.createdAt,
        members: h.members.map(m => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarIcon: m.user.avatarIcon,
          role: m.role,
        })),
      })),
    })
  } catch (error) {
    console.error('Admin households error:', error)
    return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 })
  }
}
