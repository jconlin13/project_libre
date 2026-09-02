'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Users, Plus, BookOpen, ChevronRight, Shield } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { PersonAvatar } from '@/components/discovery-module'

interface GroupSummary {
  id: string
  name: string
  inviteCode: string
  myRole: string
  memberCount: number
  booksThisYear: number
  readingNow: number
  members: Array<{ id: string; name: string; avatarUrl: string | null; avatarIcon: string | null; role: string }>
}

export function GroupsIndexContent() {
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  useEffect(() => {
    fetch('/api/groups')
      .then(r => r.json())
      .then(d => setGroups(d.data || []))
      .catch(() => toast.error('Failed to load groups'))
      .finally(() => setLoading(false))
  }, [])

  async function createGroup() {
    if (!groupName.trim()) return
    try {
      const res = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Created "${groupName}"!`)
        setCreateOpen(false)
        window.location.reload()
      } else {
        toast.error(data.error)
      }
    } catch { toast.error('Failed to create group') }
  }

  async function joinGroup() {
    if (!inviteCode.trim()) return
    try {
      const res = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Joined!')
        setJoinOpen(false)
        window.location.reload()
      } else {
        toast.error(data.error)
      }
    } catch { toast.error('Failed to join group') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Groups</h1>
          <p className="text-muted-foreground text-sm">
            Families, friends, book clubs — everyone you share reading with
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                New Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a Group</DialogTitle>
                <DialogDescription>Give your group a name. You&apos;ll get an invite code to share.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Group Name</Label>
                  <Input
                    placeholder="The Smith Family"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createGroup()}
                  />
                </div>
                <Button onClick={createGroup} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">Join</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join a Group</DialogTitle>
                <DialogDescription>Enter the invite code shared by a group member.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Invite Code</Label>
                  <Input
                    placeholder="ABCD1234"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && joinGroup()}
                  />
                </div>
                <Button onClick={joinGroup} className="w-full">Join</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading groups...</p>
      ) : groups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No groups yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Create a group to share reading with family or friends, or join one with an invite code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map(group => (
            <Link key={group.id} href={`/groups/${group.id}`} className="block">
              <Card className="h-full hover:border-primary/40 hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg flex items-center gap-2 min-w-0">
                      <span className="truncate">{group.name}</span>
                      {group.myRole === 'admin' && (
                        <Shield className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      )}
                    </CardTitle>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {group.members.slice(0, 5).map(m => (
                        <PersonAvatar key={m.id} person={m} size="h-7 w-7" />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      {group.readingNow} reading now
                    </span>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {group.booksThisYear} read this year
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
