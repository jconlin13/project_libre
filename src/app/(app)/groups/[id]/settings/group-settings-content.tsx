'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Copy, RefreshCw, Shield, LogOut, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { PersonAvatar } from '@/components/discovery-module'

interface Member {
  id: string
  name: string
  avatarUrl: string | null
  avatarIcon: string | null
  role: string
}

interface GroupDetail {
  id: string
  name: string
  inviteCode: string
  myRole: string
  members: Member[]
}

type ConfirmAction =
  | { type: 'regen' }
  | { type: 'remove-member'; memberId: string; memberName: string }
  | { type: 'leave' }

export function GroupSettingsContent({ groupId, currentUserId }: { groupId: string; currentUserId: string }) {
  const router = useRouter()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/groups/${groupId}`)
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load group')
        return d
      })
      .then(d => {
        setGroup(d.data)
        setNameDraft(d.data.name)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [groupId])

  const isAdmin = group?.myRole === 'admin'
  const adminCount = group?.members.filter(m => m.role === 'admin').length ?? 0

  async function rename() {
    const newName = nameDraft.trim()
    if (!newName || !group || newName === group.name) return
    try {
      const res = await fetch(`/api/households/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (res.ok) {
        toast.success('Group renamed')
        setGroup(g => (g ? { ...g, name: newName } : g))
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to rename')
      }
    } catch { toast.error('Failed to rename') }
  }

  async function regenInviteCode() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/households/${groupId}/invite-code`, { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        toast.success('Invite code regenerated')
        setGroup(g => (g ? { ...g, inviteCode: d.data.inviteCode } : g))
      } else {
        toast.error(d.error || 'Failed to regenerate')
      }
    } catch { toast.error('Failed to regenerate') }
    finally { setActionLoading(false); setConfirm(null) }
  }

  async function changeRole(memberId: string, newRole: string) {
    try {
      const res = await fetch(`/api/households/${groupId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        toast.success(`Role updated to ${newRole}`)
        setGroup(g => g ? { ...g, members: g.members.map(m => m.id === memberId ? { ...m, role: newRole } : m) } : g)
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to change role')
      }
    } catch { toast.error('Failed to change role') }
  }

  async function removeMember(memberId: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/households/${groupId}/members/${memberId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Member removed')
        setGroup(g => g ? { ...g, members: g.members.filter(m => m.id !== memberId) } : g)
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to remove member')
      }
    } catch { toast.error('Failed to remove member') }
    finally { setActionLoading(false); setConfirm(null) }
  }

  async function leaveGroup() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/households/${groupId}?action=leave`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Left group')
        router.push('/groups')
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to leave')
      }
    } catch { toast.error('Failed to leave') }
    finally { setActionLoading(false); setConfirm(null) }
  }

  if (loading) return <p className="text-muted-foreground">Loading group settings...</p>

  if (error || !group) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">{error || 'Group not found.'}</p>
          <Link href="/groups"><Button variant="outline" size="sm">Back to Groups</Button></Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href={`/groups/${groupId}`}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {group.name}
        </Link>
        <h1 className="text-2xl font-bold">Group Settings</h1>
      </div>

      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Group Name</CardTitle>
          <CardDescription>
            {isAdmin ? 'Rename this group.' : 'Only admins can rename the group.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && rename()}
              disabled={!isAdmin}
            />
            <Button onClick={rename} disabled={!isAdmin || nameDraft.trim() === group.name}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invite code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invite Code</CardTitle>
          <CardDescription>Share this code so others can join the group.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
              {group.inviteCode}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(group.inviteCode)
                toast.success('Invite code copied!')
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <Button variant="outline" className="gap-1.5" onClick={() => setConfirm({ type: 'regen' })}>
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            )}
          </div>
          {isAdmin && (
            <p className="text-xs text-muted-foreground mt-2">
              Regenerating invalidates the old code — anyone who hasn&apos;t joined yet will need the new one.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Members</CardTitle>
          <CardDescription>
            {isAdmin ? 'Promote members to admin or remove them from the group.' : 'Everyone in this group.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {group.members.map(member => {
            const isMe = member.id === currentUserId
            const isLastAdmin = member.role === 'admin' && adminCount === 1
            return (
              <div key={member.id} className="flex items-center gap-3 py-1">
                <PersonAvatar person={member} size="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {member.name}
                    {isMe && <span className="text-muted-foreground font-normal"> (you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
                {member.role === 'admin' && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Shield className="h-3 w-3" />
                    Admin
                  </Badge>
                )}
                {isAdmin && !isMe && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => changeRole(member.id, member.role === 'admin' ? 'member' : 'admin')}
                      disabled={isLastAdmin}
                    >
                      {member.role === 'admin' ? 'Demote' : 'Make admin'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setConfirm({ type: 'remove-member', memberId: member.id, memberName: member.name })}
                      disabled={isLastAdmin}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Leave */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg">Leave Group</CardTitle>
          <CardDescription>
            You&apos;ll need a new invite code to rejoin.
            {group.myRole === 'admin' && adminCount === 1 && ' Promote another admin before you can leave.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setConfirm({ type: 'leave' })}
            disabled={group.myRole === 'admin' && adminCount === 1 && group.members.length > 1}
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave {group.name}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!confirm} onOpenChange={open => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.type === 'regen' && 'Regenerate Invite Code'}
              {confirm?.type === 'remove-member' && 'Remove Member'}
              {confirm?.type === 'leave' && 'Leave Group'}
            </DialogTitle>
            <DialogDescription>
              {confirm?.type === 'regen' && 'The current invite code will stop working. Anyone who already joined stays in the group.'}
              {confirm?.type === 'remove-member' && `Are you sure you want to remove ${confirm.memberName} from this group?`}
              {confirm?.type === 'leave' && 'Are you sure you want to leave this group? You will need a new invite code to rejoin.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={actionLoading}
              onClick={() => {
                if (confirm?.type === 'regen') regenInviteCode()
                else if (confirm?.type === 'remove-member') removeMember(confirm.memberId)
                else if (confirm?.type === 'leave') leaveGroup()
              }}
            >
              {actionLoading ? 'Working...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
