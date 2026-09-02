'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Settings as SettingsIcon, Star, Heart, CheckCircle, Users } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { PersonAvatar, CoverThumb } from '@/components/discovery-module'
import { ActivityFeedCard, type ActivityItem } from '@/components/activity-feed'

interface Member {
  id: string
  name: string
  avatarUrl: string | null
  avatarIcon: string | null
  role: string
  hardcoverConnected: boolean
  booksThisYear: number
  currentlyReading: Array<{
    hardcoverBookId: string
    bookTitle: string | null
    bookAuthor: string | null
    bookCoverUrl: string | null
    progressPct: number | null
  }>
}

interface ShelfBook {
  hardcoverBookId: string
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
  displayScore?: number
  lastReadDate?: string | null
  by?: { id: string; name: string; avatarUrl: string | null; avatarIcon: string | null } | null
  wantedBy?: Array<{ id: string; name: string; avatarUrl: string | null; avatarIcon: string | null }>
}

interface GroupDetail {
  id: string
  name: string
  inviteCode: string
  myRole: string
  members: Member[]
  shelves: {
    mostLoved: ShelfBook[]
    recentlyFinished: ShelfBook[]
    wantToRead: ShelfBook[]
  }
}

function Shelf({
  title,
  icon: Icon,
  books,
  renderMeta,
  emptyText,
}: {
  title: string
  icon: React.ElementType
  books: ShelfBook[]
  renderMeta: (b: ShelfBook) => React.ReactNode
  emptyText: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {books.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{emptyText}</p>
        ) : (
          books.map(b => (
            <Link
              key={b.hardcoverBookId}
              href={`/book/${b.hardcoverBookId}`}
              className="flex items-start gap-2.5 rounded p-1.5 -mx-1.5 hover:bg-muted/50 transition-colors"
            >
              <CoverThumb url={b.bookCoverUrl} title={b.bookTitle} className="h-12 w-8" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-tight line-clamp-2">{b.bookTitle}</p>
                <div className="mt-1">{renderMeta(b)}</div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function GroupDetailContent({ groupId, currentUserId }: { groupId: string; currentUserId: string }) {
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/groups/${groupId}`)
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load group')
        return d
      })
      .then(d => setGroup(d.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))

    fetch(`/api/activity?groupId=${groupId}&limit=10`)
      .then(r => r.json())
      .then(d => setActivity(d.data || []))
      .catch(() => {})

    // Keep member snapshots reasonably fresh (30-min staleness window server-side)
    fetch('/api/snapshots/refresh', { method: 'POST' }).catch(() => {})
  }, [groupId])

  if (loading) {
    return <p className="text-muted-foreground">Loading group...</p>
  }

  if (error || !group) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">{error || 'Group not found.'}</p>
          <Link href="/groups">
            <Button variant="outline" size="sm">Back to Groups</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  const { shelves } = group

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/groups"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Groups
          </Link>
          <h1 className="text-2xl font-bold truncate">{group.name}</h1>
          <p className="text-muted-foreground text-sm">
            {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge
            variant="outline"
            className="gap-1 font-mono text-xs cursor-pointer hover:bg-muted"
            onClick={() => {
              navigator.clipboard.writeText(group.inviteCode)
              toast.success('Invite code copied!')
            }}
          >
            {group.inviteCode}
          </Badge>
          <Link href={`/groups/${group.id}/settings`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SettingsIcon className="h-3.5 w-3.5" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Main column — roster, then recent activity */}
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {group.members.map(member => (
              <Card key={member.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/person/${member.id}`}>
                      <PersonAvatar person={member} size="h-10 w-10" />
                    </Link>
                    <div className="min-w-0">
                      <Link href={`/person/${member.id}`} className="hover:underline">
                        <CardTitle className="text-base truncate">
                          {member.name}
                          {member.id === currentUserId && (
                            <span className="text-muted-foreground font-normal"> (you)</span>
                          )}
                        </CardTitle>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {member.booksThisYear} read this year
                      </p>
                    </div>
                    {member.role === 'admin' && (
                      <Badge variant="secondary" className="ml-auto text-xs">Admin</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!member.hardcoverConnected ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      Hardcover not connected
                    </p>
                  ) : member.currentlyReading.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      Not reading anything right now
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {member.currentlyReading.map(b => (
                        <Link
                          key={b.hardcoverBookId}
                          href={`/book/${b.hardcoverBookId}`}
                          className="flex items-start gap-2.5 rounded p-1 -mx-1 hover:bg-muted/50 transition-colors"
                        >
                          <CoverThumb url={b.bookCoverUrl} title={b.bookTitle} className="h-14 w-10" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight line-clamp-2">{b.bookTitle}</p>
                            <p className="text-xs text-muted-foreground truncate">{b.bookAuthor}</p>
                            {b.progressPct != null && b.progressPct > 0 && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${Math.min(100, b.progressPct)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {Math.round(b.progressPct)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <ActivityFeedCard
            items={activity}
            title="Recent Activity"
            emptyMessage="No activity in this group yet."
            limit={8}
          />
        </div>

        {/* Sidebar — group shelves */}
        <aside className="space-y-4">
          <Shelf
            title="Most Loved"
            icon={Star}
            books={shelves.mostLoved}
            emptyText="No ranked books yet."
            renderMeta={b => (
              <span className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  {b.displayScore?.toFixed(1)}
                </span>
                {b.by && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    {b.by.name.split(' ')[0]}
                  </span>
                )}
              </span>
            )}
          />

          <Shelf
            title="Recently Finished"
            icon={CheckCircle}
            books={shelves.recentlyFinished}
            emptyText="Nothing finished yet."
            renderMeta={b => (
              <span className="text-[11px] text-muted-foreground truncate">
                {b.by?.name.split(' ')[0]}
                {b.lastReadDate && ` · ${new Date(b.lastReadDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
              </span>
            )}
          />

          <Shelf
            title="Want to Read"
            icon={Heart}
            books={shelves.wantToRead}
            emptyText="No wishlist books yet."
            renderMeta={b => (
              <span className="flex items-center gap-1">
                <span className="flex -space-x-1">
                  {(b.wantedBy || []).slice(0, 3).map(p => (
                    <PersonAvatar key={p.id} person={p} size="h-4 w-4" />
                  ))}
                </span>
                {(b.wantedBy?.length || 0) > 1 && (
                  <span className="text-[11px] text-muted-foreground">
                    {b.wantedBy!.length} want it
                  </span>
                )}
              </span>
            )}
          />
        </aside>
      </div>
    </div>
  )
}
