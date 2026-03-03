import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { SettingsContent } from './settings-content'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const households = user.householdMembers.map(m => ({
    id: m.household.id,
    name: m.household.name,
    inviteCode: m.household.inviteCode,
    role: m.role,
    members: m.household.members.map(hm => ({
      id: hm.user.id,
      name: hm.user.name,
      email: hm.user.email,
      avatarUrl: hm.user.avatarUrl,
      avatarIcon: hm.user.avatarIcon,
      role: hm.role,
    })),
  }))

  return (
    <SettingsContent
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        avatarIcon: user.avatarIcon,
        hardcoverConnected: !!user.hardcoverApiToken,
        hardcoverUsername: user.hardcoverUsername,
      }}
      households={households}
    />
  )
}
