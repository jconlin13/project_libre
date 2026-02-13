import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { fetchUserProfile } from '@/lib/hardcover'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let { token } = await request.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    // Strip "Bearer " prefix if someone pastes the full header value
    token = token.replace(/^Bearer\s+/i, '').trim()

    // Verify token works
    const profile = await fetchUserProfile(token)
    if (!profile) {
      return NextResponse.json({ error: 'Invalid Hardcover token' }, { status: 400 })
    }

    // Encrypt and store
    const encryptedToken = encrypt(token)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        hardcoverApiToken: encryptedToken,
        hardcoverUserId: String(profile.id),
        hardcoverUsername: profile.username,
      }
    })

    return NextResponse.json({ data: { username: profile.username } })
  } catch (error) {
    console.error('Connect Hardcover error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        hardcoverApiToken: null,
        hardcoverUserId: null,
        hardcoverUsername: null,
      }
    })

    return NextResponse.json({ data: { disconnected: true } })
  } catch (error) {
    console.error('Disconnect Hardcover error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
