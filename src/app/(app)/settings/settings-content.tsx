'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ExternalLink, Check, X, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'

interface SettingsContentProps {
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    hardcoverConnected: boolean
    hardcoverUsername: string | null
  }
}

export function SettingsContent({ user }: SettingsContentProps) {
  const [token, setToken] = useState('')
  const [connecting, setConnecting] = useState(false)

  async function connectHardcover() {
    if (!token.trim()) return
    setConnecting(true)
    try {
      const res = await fetch('/api/settings/hardcover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Connected as @${data.data?.username || data.username}`)
        window.location.reload()
      } else {
        toast.error(data.error || 'Failed to connect')
      }
    } catch {
      toast.error('Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  async function disconnectHardcover() {
    try {
      const res = await fetch('/api/settings/hardcover', { method: 'DELETE' })
      if (res.ok) {
        toast.success('Disconnected from Hardcover')
        window.location.reload()
      }
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and connections</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <p className="text-sm font-medium">{user.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Hardcover Connection</CardTitle>
              <CardDescription>
                Connect your Hardcover account to sync your reading activity
              </CardDescription>
            </div>
            {user.hardcoverConnected ? (
              <Badge className="gap-1 bg-green-600">
                <Check className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <X className="h-3 w-3" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.hardcoverConnected ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Username</Label>
                <p className="text-sm font-medium">@{user.hardcoverUsername}</p>
              </div>
              <Separator />
              <Button variant="destructive" size="sm" onClick={disconnectHardcover}>
                Disconnect Hardcover
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-2">
                <p>To connect your Hardcover account:</p>
                <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                  <li>Go to your Hardcover account settings</li>
                  <li>Click on &ldquo;API&rdquo; in the sidebar</li>
                  <li>Copy your API token</li>
                  <li>Paste it below</li>
                </ol>
                <a
                  href="https://hardcover.app/account/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
                >
                  Open Hardcover API Settings
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="space-y-2">
                <Label htmlFor="token">API Token</Label>
                <div className="flex gap-2">
                  <Input
                    id="token"
                    type="password"
                    placeholder="Paste your Hardcover API token"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && connectHardcover()}
                  />
                  <Button onClick={connectHardcover} disabled={connecting || !token.trim()}>
                    {connecting ? 'Connecting...' : 'Connect'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Family Book Club is a private overlay for Hardcover that brings your family&apos;s reading activity together.</p>
          <p>Built with Next.js, Supabase, and the Hardcover GraphQL API.</p>
        </CardContent>
      </Card>
    </div>
  )
}
