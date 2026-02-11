import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { action, name, email } = await request.json()

    if (action === 'login' || action === 'register') {
      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email required' }, { status: 400 })
      }

      let user = await prisma.user.findUnique({ where: { email } })

      if (!user && action === 'register') {
        if (!name || typeof name !== 'string') {
          return NextResponse.json({ error: 'Name required for registration' }, { status: 400 })
        }
        user = await prisma.user.create({
          data: {
            email,
            name,
            supabaseAuthId: `local-${crypto.randomUUID()}`,
          }
        })
      }

      if (!user) {
        return NextResponse.json({ error: 'User not found. Register first.' }, { status: 404 })
      }

      // Set session cookie
      const cookieStore = await cookies()
      cookieStore.set('local-session', user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })

      return NextResponse.json({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
        }
      })
    }

    if (action === 'logout') {
      const cookieStore = await cookies()
      cookieStore.delete('local-session')
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Local auth error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auth error' },
      { status: 500 }
    )
  }
}
