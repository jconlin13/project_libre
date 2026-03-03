'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Home, ThumbsUp, Settings, LogOut, Menu, Moon, Sun, Link2, MessageSquare, Search, Newspaper, Shield } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useFontSize } from '@/components/font-size-provider'
import { SearchCommand } from '@/components/search-command'
import { getAvatarEmoji } from '@/lib/avatar-icons'
import { useState, useEffect } from 'react'

const isLocalAuth = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === ''

interface AppShellProps {
  children: React.ReactNode
  user: {
    name: string
    email: string
    avatarUrl?: string | null
    avatarIcon?: string | null
    isAdmin?: boolean
  }
}

const baseNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/reads', label: 'Reads', icon: Newspaper },
  { href: '/recommendations', label: 'Recommendations', icon: ThumbsUp },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell({ children, user }: AppShellProps) {
  const navItems = user.isAdmin
    ? [...baseNavItems, { href: '/admin', label: 'Admin', icon: Shield }]
    : baseNavItems
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { level: fontLevel, increase: fontIncrease, decrease: fontDecrease } = useFontSize()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Global Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleSignOut() {
    if (isLocalAuth) {
      await fetch('/api/auth/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
    } else {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.auth.signOut()
    }
    router.push('/')
    router.refresh()
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const avatarEmoji = getAvatarEmoji(user.avatarIcon)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <nav className="mt-8 space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        pathname === item.href
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            <Link href="/dashboard" className="flex items-center gap-2.5">
              <Image src="/logos/logo.svg" alt="Family Book Club" width={36} height={36} className="rounded" />
              <span className="text-lg font-bold hidden sm:inline">Family Book Club</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1.5">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={pathname === item.href ? 'secondary' : 'ghost'}
                    size="default"
                    className="gap-2 text-base"
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            {/* Search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center justify-between rounded-md border border-input bg-background text-foreground/60 hover:bg-muted transition-colors cursor-pointer"
              style={{ height: '36px', minWidth: '150px', fontSize: '14px', padding: '0 12px' }}
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search</span>
              </div>
              <kbd
                className="inline-flex items-center rounded border border-border bg-muted text-foreground/60"
                style={{ fontSize: '11px', padding: '1px 5px', marginLeft: '12px' }}
              >
                &#8984;K
              </kbd>
            </button>

            {/* Font size toggle */}
            <div className="inline-flex items-center rounded-md border border-input bg-background" style={{ fontSize: '16px' }}>
              <button
                onClick={fontDecrease}
                disabled={fontLevel <= -3}
                className="inline-flex items-center justify-center rounded-l-md font-medium hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                style={{ width: '32px', height: '32px' }}
                title="Decrease text size"
              >
                <span style={{ fontSize: '12px', fontWeight: 700 }}>A</span>
              </button>
              <div className="bg-border" style={{ width: '1px', height: '20px' }} />
              <button
                onClick={fontIncrease}
                disabled={fontLevel >= 5}
                className="inline-flex items-center justify-center rounded-r-md font-medium hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                style={{ width: '32px', height: '32px' }}
                title="Increase text size"
              >
                <span style={{ fontSize: '16px', fontWeight: 700 }}>A</span>
              </button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl || undefined} />
                    <AvatarFallback className={avatarEmoji ? 'text-lg' : 'text-xs'}>
                      {avatarEmoji || initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {children}
      </main>

      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />

      <footer className="border-t mt-8">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>Family Book Club</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin)
                toast.success('Referral link copied!')
              }}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
            >
              <Link2 className="h-3.5 w-3.5" />
              Copy referral link
            </button>
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/feedback" target="_blank" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <MessageSquare className="h-3.5 w-3.5" />
              Submit Feedback
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
