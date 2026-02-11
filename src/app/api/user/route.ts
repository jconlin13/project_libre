import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

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
