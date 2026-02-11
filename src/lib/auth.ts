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

    return prisma.user.findUnique({
      where: { id: userId },
      include: userInclude,
    })
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
