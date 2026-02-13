import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { SearchContent } from './search-content'

export default async function SearchPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <SearchContent hardcoverConnected={!!user.hardcoverApiToken} />
}
