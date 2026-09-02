import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { FriendsContent } from './friends-content'

export const dynamic = 'force-dynamic'

export default async function FriendsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <FriendsContent />
}
