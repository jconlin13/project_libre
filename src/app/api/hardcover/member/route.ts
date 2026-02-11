import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import {
  fetchCurrentlyReading,
  fetchFinishedBooks,
  fetchWantToRead,
  fetchUserProfile
} from '@/lib/hardcover'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const action = searchParams.get('action')

    if (!memberId) {
      return NextResponse.json({ error: 'memberId required' }, { status: 400 })
    }

    // Verify same household
    const currentHouseholds = await prisma.householdMember.findMany({
      where: { userId: currentUser.id },
      select: { householdId: true }
    })
    const householdIds = currentHouseholds.map(h => h.householdId)

    const isSameHousehold = await prisma.householdMember.findFirst({
      where: {
        userId: memberId,
        householdId: { in: householdIds }
      }
    })

    if (!isSameHousehold) {
      return NextResponse.json({ error: 'Not in same household' }, { status: 403 })
    }

    const member = await prisma.user.findUnique({ where: { id: memberId } })
    if (!member?.hardcoverApiToken) {
      return NextResponse.json({ error: 'Member has no Hardcover connection' }, { status: 400 })
    }

    const token = decrypt(member.hardcoverApiToken)

    let data
    switch (action) {
      case 'profile':
        data = await fetchUserProfile(token)
        break
      case 'reading':
        data = await fetchCurrentlyReading(token)
        break
      case 'finished':
        data = await fetchFinishedBooks(token)
        break
      case 'want-to-read':
        data = await fetchWantToRead(token)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Member data error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
