import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { logAudit } from '@/lib/audit'
import { isRateLimited } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { action, name, email } = await request.json()
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null

    if (action === 'login' || action === 'register') {
      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email required' }, { status: 400 })
      }

      // Rate limit: 10 attempts per email per 15 minutes
      if (isRateLimited(`auth:${email.toLowerCase()}`, 10, 15 * 60 * 1000)) {
        return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
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

      await logAudit({ userId: user.id, action: action === 'register' ? 'register' : 'login', ipAddress: ip })

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
      const sessionCookie = cookieStore.get('local-session')
      const userId = sessionCookie?.value || null
      cookieStore.delete('local-session')
      await logAudit({ userId, action: 'logout', ipAddress: ip })
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
