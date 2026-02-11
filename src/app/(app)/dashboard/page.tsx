import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardContent } from './dashboard-content'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const memberships = await prisma.householdMember.findMany({
    where: { userId: user.id },
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

  const households = memberships.map(m => ({
    id: m.household.id,
    name: m.household.name,
    inviteCode: m.household.inviteCode,
    role: m.role,
    members: m.household.members.map(hm => ({
      id: hm.user.id,
      name: hm.user.name,
      email: hm.user.email,
      avatarUrl: hm.user.avatarUrl,
      hardcoverConnected: !!hm.user.hardcoverApiToken,
      hardcoverUsername: hm.user.hardcoverUsername,
      role: hm.role,
    }))
  }))

  const hasHousehold = households.length > 0
  const hardcoverConnected = !!user.hardcoverApiToken

  return (
    <DashboardContent
      currentUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        hardcoverConnected,
        hardcoverUsername: user.hardcoverUsername,
      }}
      households={households}
      hasHousehold={hasHousehold}
    />
  )
}
