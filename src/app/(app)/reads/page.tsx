import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ReadsContent } from './reads-content'

export default async function ReadsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <ReadsContent userId={user.id} />
}
