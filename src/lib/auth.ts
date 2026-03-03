import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

const isLocalAuth = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.AUTH_MODE === 'local'

async function getLocalSessionUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local-session')
    return sessionCookie?.value || null
  } catch {
    return null
  }
}

const userInclude = {
  householdMembers: {
    include: {
      household: {
        include: {
          members: {
            include: { user: true }
          }
        }
      }
    }
  }
} as const

export async function getCurrentUser() {
  if (isLocalAuth) {
    const userId = await getLocalSessionUserId()
    if (!userId) return null

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: userInclude,
    })
    if (!user) return null

    // Sync admin status based on ADMIN_EMAIL env var
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
    const shouldBeAdmin = !!adminEmail && user.email.toLowerCase() === adminEmail
    if (user.isAdmin !== shouldBeAdmin) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: shouldBeAdmin },
      })
      user.isAdmin = shouldBeAdmin
    }

    return user
  }

  // Supabase auth mode
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return null

    let dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: authUser.id },
      include: userInclude,
    })

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          supabaseAuthId: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          avatarUrl: authUser.user_metadata?.avatar_url || null,
        },
        include: userInclude,
      })
    }

    return dbUser
  } catch {
    return null
  }
}

export async function verifyHouseholdAdmin(userId: string, householdId: string) {
  const membership = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId } },
  })
  if (!membership) return { error: 'Not a member', status: 403 as const }
  if (membership.role !== 'admin') return { error: 'Not an admin', status: 403 as const }
  return { membership }
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || !user.isAdmin) return null
  return user
}

export async function getHouseholdMembers(userId: string) {
  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    include: {
      household: {
        include: {
          members: {
            include: { user: true }
          }
        }
      }
    }
  })

  const members = memberships.flatMap(m =>
    m.household.members
      .filter(hm => hm.userId !== userId)
      .map(hm => hm.user)
  )

  return [...new Map(members.map(m => [m.id, m])).values()]
}
