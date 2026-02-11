import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { SettingsContent } from './settings-content'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <SettingsContent
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        hardcoverConnected: !!user.hardcoverApiToken,
        hardcoverUsername: user.hardcoverUsername,
      }}
    />
  )
}
