'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { UserPlus, Users, BookOpen, Check, X, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { PersonAvatar, CoverThumb } from '@/components/discovery-module'

interface CurrentRead {
  hardcoverBookId: string
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
  progressPct: number | null
}

interface Friend {
  id: string
  name: string
  avatarUrl: string | null
  avatarIcon: string | null
  sharedGroups: Array<{ id: string; name: string }>
  isDirect: boolean
  booksThisYear: number
  currentlyReading: CurrentRead[]
}

interface PendingUser {
  id: string
  user: { id: string; name: string; avatarUrl: string | null; avatarIcon: string | null }
}

interface FriendsData {
  groups: Array<{ id: string; name: string; friends: Friend[] }>
  directOnly: Friend[]
  totalFriends: number
  requests: { incoming: PendingUser[]; outgoing: PendingUser[] }
}

function FriendCard({ friend }: { friend: Friend }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link href={`/person/${friend.id}`}>
            <PersonAvatar person={friend} size="h-10 w-10" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link href={`/person/${friend.id}`} className="hover:underline">
                <p className="font-medium truncate">{friend.name}</p>
              </Link>
              {friend.isDirect && friend.sharedGroups.length === 0 && (
                <Badge variant="outline" className="text-[10px] font-normal">Direct</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {friend.booksThisYear} read this year
              {friend.sharedGroups.length > 1 && ` · ${friend.sharedGroups.length} shared groups`}
            </p>

            {friend.currentlyReading.length > 0 ? (
              <div className="mt-3 space-y-2">
                {friend.currentlyReading.map(b => (
                  <Link
                    key={b.hardcoverBookId}
                    href={`/book/${b.hardcoverBookId}`}
                    className="flex items-start gap-2 rounded p-1 -m-1 hover:bg-muted/50 transition-colors"
                  >
                    <CoverThumb url={b.bookCoverUrl} title={b.bookTitle} className="h-12 w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-tight line-clamp-2">{b.bookTitle}</p>
                      {b.progressPct != null && b.progressPct > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, b.progressPct)}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{Math.round(b.progressPct)}%</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">Not reading anything right now</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function FriendsContent() {
  const [data, setData] = useState<FriendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(() => {
    fetch('/api/friends')
      .then(r => r.json())
      .then(d => setData(d.data || null))
      .catch(() => toast.error('Failed to load friends'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  async function sendRequest() {
    if (!email.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/friends/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await res.json()
      if (res.ok) {
        toast.success(d.data?.message || 'Request sent')
        setAddOpen(false)
        setEmail('')
        load()
      } else {
        toast.error(d.error || 'Failed to send request')
      }
    } catch { toast.error('Failed to send request') }
    finally { setSending(false) }
  }

  async function respond(id: string, action: 'accept' | 'decline') {
    try {
      const res = await fetch('/api/friends/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (res.ok) {
        toast.success(action === 'accept' ? 'Friend added!' : 'Request declined')
        load()
      } else {
        toast.error('Failed to update request')
      }
    } catch { toast.error('Failed to update request') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Friends</h1>
          <p className="text-muted-foreground text-sm">
            {data ? `${data.totalFriends} ${data.totalFriends === 1 ? 'person' : 'people'} you read alongside` : 'People you read alongside'}
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              Add Friend
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a Friend</DialogTitle>
              <DialogDescription>
                Send a request by email. Anyone in your groups is already a friend.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Their email</Label>
                <Input
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendRequest()}
                />
              </div>
              <Button onClick={sendRequest} className="w-full" disabled={sending}>
                {sending ? 'Sending...' : 'Send Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Incoming requests */}
      {data && data.requests.incoming.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {data.requests.incoming.length} friend {data.requests.incoming.length === 1 ? 'request' : 'requests'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.requests.incoming.map(req => (
              <div key={req.id} className="flex items-center gap-3">
                <PersonAvatar person={req.user} size="h-8 w-8" />
                <span className="text-sm flex-1 truncate">{req.user.name}</span>
                <Button size="sm" className="h-7 gap-1" onClick={() => respond(req.id, 'accept')}>
                  <Check className="h-3 w-3" />
                  Accept
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => respond(req.id, 'decline')}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading friends...</p>
      ) : !data || data.totalFriends === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center text-center">
            <UserRound className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No friends yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Join a group to connect with the people in it, or send a friend request by email.
            </p>
            <Link href="/groups">
              <Button variant="outline" size="sm">Browse your groups</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Organized by group */}
          {data.groups.filter(g => g.friends.length > 0).map(group => (
            <div key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="flex items-center gap-2 mb-3 hover:underline w-fit"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <span className="text-sm text-muted-foreground">
                  {group.friends.length} {group.friends.length === 1 ? 'person' : 'people'}
                </span>
              </Link>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.friends.map(f => <FriendCard key={f.id} friend={f} />)}
              </div>
            </div>
          ))}

          {/* Direct friends outside any shared group */}
          {data.directOnly.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Also friends</h2>
                <span className="text-sm text-muted-foreground">not in a shared group</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.directOnly.map(f => <FriendCard key={f.id} friend={f} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
