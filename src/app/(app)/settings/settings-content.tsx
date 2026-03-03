'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ExternalLink, Check, X, Shield, UserMinus, RefreshCw, ArrowUpDown, LogOut, Download, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { IconAvatarPicker } from '@/components/icon-avatar-picker'
import { getAvatarEmoji } from '@/lib/avatar-icons'

interface HouseholdMemberInfo {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  avatarIcon: string | null
  role: string
}

interface HouseholdInfo {
  id: string
  name: string
  inviteCode: string
  role: string
  members: HouseholdMemberInfo[]
}

interface SettingsContentProps {
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    avatarIcon: string | null
    hardcoverConnected: boolean
    hardcoverUsername: string | null
  }
  households: HouseholdInfo[]
}

export function SettingsContent({ user, households: initialHouseholds }: SettingsContentProps) {
  const router = useRouter()

  // Profile state
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [avatarIcon, setAvatarIcon] = useState<string | null>(user.avatarIcon)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const profileChanged = name !== user.name || email !== user.email || avatarIcon !== user.avatarIcon

  // Hardcover state
  const [token, setToken] = useState('')
  const [connecting, setConnecting] = useState(false)

  // Household state
  const [households, setHouseholds] = useState(initialHouseholds)
  const [editingHouseholdName, setEditingHouseholdName] = useState<Record<string, string>>({})
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'remove-member' | 'regen-invite' | 'leave' | 'delete-account'
    householdId?: string
    memberId?: string
    memberName?: string
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Delete account state
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const emoji = getAvatarEmoji(avatarIcon)

  // ---- Profile ----

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, avatarIcon }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Profile updated')
        window.location.reload()
      } else {
        toast.error(data.error || 'Failed to update profile')
      }
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  // ---- Hardcover ----

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

  // ---- Household Admin ----

  async function renameHousehold(householdId: string) {
    const newName = editingHouseholdName[householdId]?.trim()
    if (!newName) return
    try {
      const res = await fetch(`/api/households/${householdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (res.ok) {
        toast.success('Household renamed')
        setHouseholds(prev => prev.map(h => h.id === householdId ? { ...h, name: newName } : h))
        setEditingHouseholdName(prev => { const next = { ...prev }; delete next[householdId]; return next })
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to rename')
      }
    } catch {
      toast.error('Failed to rename')
    }
  }

  async function regenInviteCode(householdId: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/households/${householdId}/invite-code`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success('Invite code regenerated')
        setHouseholds(prev => prev.map(h => h.id === householdId ? { ...h, inviteCode: data.data.inviteCode } : h))
      } else {
        toast.error(data.error || 'Failed to regenerate')
      }
    } catch {
      toast.error('Failed to regenerate')
    } finally {
      setActionLoading(false)
      setConfirmDialog(null)
    }
  }

  async function changeRole(householdId: string, memberId: string, newRole: string) {
    try {
      const res = await fetch(`/api/households/${householdId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        toast.success(`Role updated to ${newRole}`)
        setHouseholds(prev => prev.map(h =>
          h.id === householdId
            ? { ...h, members: h.members.map(m => m.id === memberId ? { ...m, role: newRole } : m) }
            : h
        ))
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to change role')
      }
    } catch {
      toast.error('Failed to change role')
    }
  }

  async function removeMember(householdId: string, memberId: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/households/${householdId}/members/${memberId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Member removed')
        setHouseholds(prev => prev.map(h =>
          h.id === householdId
            ? { ...h, members: h.members.filter(m => m.id !== memberId) }
            : h
        ))
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to remove member')
      }
    } catch {
      toast.error('Failed to remove member')
    } finally {
      setActionLoading(false)
      setConfirmDialog(null)
    }
  }

  async function leaveHousehold(householdId: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/households/${householdId}?action=leave`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Left household')
        setHouseholds(prev => prev.filter(h => h.id !== householdId))
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to leave')
      }
    } catch {
      toast.error('Failed to leave')
    } finally {
      setActionLoading(false)
      setConfirmDialog(null)
    }
  }

  // ---- Delete Account ----

  async function deleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: deleteConfirmEmail }),
      })
      if (res.ok) {
        toast.success('Account deleted')
        router.push('/login')
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete account')
      }
    } catch {
      toast.error('Failed to delete account')
    } finally {
      setDeleting(false)
    }
  }

  function renderMemberAvatar(member: HouseholdMemberInfo) {
    const memberEmoji = getAvatarEmoji(member.avatarIcon)
    const memberInitials = member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    return (
      <Avatar className="h-8 w-8">
        <AvatarImage src={member.avatarUrl || undefined} />
        <AvatarFallback className="text-xs">
          {memberEmoji || memberInitials}
        </AvatarFallback>
      </Avatar>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and connections</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAvatarPickerOpen(true)}
              className="relative cursor-pointer group"
            >
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback className="text-2xl">
                  {emoji || initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium">Edit</span>
              </div>
            </button>
            <div className="text-sm text-muted-foreground">
              Click to choose an avatar icon
            </div>
          </div>

          <IconAvatarPicker
            open={avatarPickerOpen}
            onOpenChange={setAvatarPickerOpen}
            currentIcon={avatarIcon}
            onSelect={setAvatarIcon}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          {profileChanged && (
            <div className="flex gap-2">
              <Button onClick={saveProfile} disabled={savingProfile} size="sm">
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setName(user.name); setEmail(user.email); setAvatarIcon(user.avatarIcon) }}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hardcover Connection */}
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

      {/* Household Management */}
      {households.length > 0 && households.map(household => (
        <Card key={household.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {household.role === 'admin' ? (
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      {household.name}
                    </div>
                  ) : household.name}
                </CardTitle>
                <CardDescription>
                  {household.role === 'admin' ? 'You are an admin of this household' : 'You are a member of this household'}
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {household.inviteCode}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Admin: Rename */}
            {household.role === 'admin' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Household Name</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingHouseholdName[household.id] ?? household.name}
                    onChange={e => setEditingHouseholdName(prev => ({ ...prev, [household.id]: e.target.value }))}
                    className="max-w-xs"
                  />
                  {editingHouseholdName[household.id] !== undefined && editingHouseholdName[household.id] !== household.name && (
                    <Button size="sm" onClick={() => renameHousehold(household.id)}>
                      Save
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Admin: Regen invite code */}
            {household.role === 'admin' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setConfirmDialog({ type: 'regen-invite', householdId: household.id })}
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerate Invite Code
                </Button>
              </div>
            )}

            <Separator />

            {/* Member list */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Members</Label>
              {household.members.map(member => (
                <div key={member.id} className="flex items-center gap-3 py-2">
                  {renderMemberAvatar(member)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                    {member.role}
                  </Badge>
                  {household.role === 'admin' && member.id !== user.id && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={member.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                        onClick={() => changeRole(household.id, member.id, member.role === 'admin' ? 'member' : 'admin')}
                      >
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Remove member"
                        onClick={() => setConfirmDialog({ type: 'remove-member', householdId: household.id, memberId: member.id, memberName: member.name })}
                      >
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Leave household (for non-admins, or admins with other admins) */}
            <Separator />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setConfirmDialog({ type: 'leave', householdId: household.id })}
            >
              <LogOut className="h-3 w-3" />
              Leave Household
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Your Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Data</CardTitle>
          <CardDescription>Export or manage your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => { window.location.href = '/api/user/export' }}
          >
            <Download className="h-3 w-3" />
            Export All Data
          </Button>
          <p className="text-xs text-muted-foreground">
            Downloads a JSON file with all your reading data, articles, recommendations, and rankings.
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => { setDeleteDialogOpen(true); setDeleteConfirmEmail('') }}
          >
            <Trash2 className="h-3 w-3" />
            Delete Account
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Family Book Club is a private overlay for Hardcover that brings your family&apos;s reading activity together.</p>
          <p>Built with Next.js and the Hardcover GraphQL API.</p>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog !== null} onOpenChange={open => { if (!open) setConfirmDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === 'remove-member' && 'Remove Member'}
              {confirmDialog?.type === 'regen-invite' && 'Regenerate Invite Code'}
              {confirmDialog?.type === 'leave' && 'Leave Household'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === 'remove-member' && `Are you sure you want to remove ${confirmDialog.memberName} from this household?`}
              {confirmDialog?.type === 'regen-invite' && 'This will invalidate the current invite code. Anyone with the old code will no longer be able to join.'}
              {confirmDialog?.type === 'leave' && 'Are you sure you want to leave this household? You will need a new invite code to rejoin.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setConfirmDialog(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={actionLoading}
              onClick={() => {
                if (!confirmDialog) return
                if (confirmDialog.type === 'remove-member' && confirmDialog.householdId && confirmDialog.memberId) {
                  removeMember(confirmDialog.householdId, confirmDialog.memberId)
                } else if (confirmDialog.type === 'regen-invite' && confirmDialog.householdId) {
                  regenInviteCode(confirmDialog.householdId)
                } else if (confirmDialog.type === 'leave' && confirmDialog.householdId) {
                  leaveHousehold(confirmDialog.householdId)
                }
              }}
            >
              {actionLoading ? 'Please wait...' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all associated data including your reading history, articles, recommendations, and rankings. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Type your email to confirm: <span className="font-mono text-xs">{user.email}</span></Label>
              <Input
                placeholder={user.email}
                value={deleteConfirmEmail}
                onChange={e => setDeleteConfirmEmail(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirmEmail !== user.email || deleting}
                onClick={deleteAccount}
              >
                {deleting ? 'Deleting...' : 'Delete My Account'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
