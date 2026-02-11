import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { RecommendationsContent } from './recommendations-content'

export default async function RecommendationsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <RecommendationsContent userId={user.id} hardcoverConnected={!!user.hardcoverApiToken} />
}
