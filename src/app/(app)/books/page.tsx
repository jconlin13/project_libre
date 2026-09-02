import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { MyBooksContent } from './my-books-content'

export const dynamic = 'force-dynamic'

export default async function MyBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { tab } = await searchParams
  return <MyBooksContent userId={user.id} initialTab={tab} />
}
