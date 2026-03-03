export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <AppShell user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl, avatarIcon: user.avatarIcon, isAdmin: user.isAdmin }}>
      {children}
    </AppShell>
  )
}
