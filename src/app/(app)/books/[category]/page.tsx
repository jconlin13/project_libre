import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { BooksContent } from './books-content'

const VALID_CATEGORIES = ['all', 'want-to-read', 'currently-reading', 'read', 'not-finished'] as const

export default async function BooksPage({ params }: { params: Promise<{ category: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { category } = await params

  if (!VALID_CATEGORIES.includes(category as any)) {
    redirect('/books/all')
  }

  return (
    <BooksContent
      category={category}
      hardcoverConnected={!!user.hardcoverApiToken}
    />
  )
}
