import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { GroupSettingsContent } from './group-settings-content'

export const dynamic = 'force-dynamic'

export default async function GroupSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  return <GroupSettingsContent groupId={id} currentUserId={user.id} />
}
