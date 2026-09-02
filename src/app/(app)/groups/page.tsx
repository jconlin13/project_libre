import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { GroupsIndexContent } from './groups-index-content'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <GroupsIndexContent />
}
