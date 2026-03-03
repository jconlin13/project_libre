import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { AdminContent } from './admin-content'

export default async function AdminPage() {
  const admin = await requireAdmin()
  if (!admin) redirect('/dashboard')

  return <AdminContent />
}
