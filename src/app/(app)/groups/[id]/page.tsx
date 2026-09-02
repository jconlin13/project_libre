import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { GroupDetailContent } from './group-detail-content'

export const dynamic = 'force-dynamic'

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  return <GroupDetailContent groupId={id} currentUserId={user.id} />
}
