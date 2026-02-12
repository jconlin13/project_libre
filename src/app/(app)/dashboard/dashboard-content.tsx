'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { BookCard } from '@/components/book-card'
import { MemberCardSkeleton } from '@/components/loading-skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Users, Copy, BookOpen, AlertCircle, BookMarked, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Member {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  hardcoverConnected: boolean
  hardcoverUsername: string | null
  role: string
}

interface Household {
  id: string
  name: string
  inviteCode: string
  role: string
  members: Member[]
}

interface DashboardContentProps {
  currentUser: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    hardcoverConnected: boolean
    hardcoverUsername: string | null
  }
  households: Household[]
  hasHousehold: boolean
}

interface MemberBooks {
  reading: Array<{ id: number; book: any; rating?: number | null; user_book_reads?: Array<{ progress: number | null; progress_pages: number | null }> }>
  finished: Array<{ id: number; book: any; rating?: number | null }>
}

export function DashboardContent({ currentUser, households, hasHousehold }: DashboardContentProps) {
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [memberBooks, setMemberBooks] = useState<Record<string, MemberBooks>>({})
  const [loadingMembers, setLoadingMembers] = useState<Set<string>>(new Set())
  const [activity, setActivity] = useState<any[]>([])
  const [myBooks, setMyBooks] = useState<MemberBooks | null>(null)
  const [loadingMyBooks, setLoadingMyBooks] = useState(false)

  const fetchMemberBooks = useCallback(async (memberId: string) => {
    setLoadingMembers(prev => new Set(prev).add(memberId))
    try {
      const isCurrentUser = memberId === currentUser.id
      const baseUrl = isCurrentUser ? '/api/hardcover' : '/api/hardcover/member'
      const params = isCurrentUser ? '' : `&memberId=${memberId}`

      const [readingRes, finishedRes] = await Promise.all([
        fetch(`${baseUrl}?action=reading${params}`),
        fetch(`${baseUrl}?action=finished&limit=5${params}`),
      ])

      const readingData = await readingRes.json()
      const finishedData = await finishedRes.json()

      setMemberBooks(prev => ({
        ...prev,
        [memberId]: {
          reading: readingData.data || [],
          finished: finishedData.data || [],
        }
      }))
    } catch (error) {
      console.error('Failed to fetch member books:', error)
    } finally {
      setLoadingMembers(prev => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
    }
  }, [currentUser.id])

  // Fetch current user's books regardless of household status
  useEffect(() => {
    if (!currentUser.hardcoverConnected) return

    setLoadingMyBooks(true)
    Promise.all([
      fetch('/api/hardcover?action=reading').then(r => r.json()),
      fetch('/api/hardcover?action=finished&limit=5').then(r => r.json()),
    ]).then(([readingData, finishedData]) => {
      setMyBooks({
        reading: readingData.data || [],
        finished: finishedData.data || [],
      })
    }).catch(console.error).finally(() => setLoadingMyBooks(false))
  }, [currentUser.hardcoverConnected])

  useEffect(() => {
    if (!hasHousehold) return

    // Fetch other household members' books (skip current user, already fetched above)
    const allMembers = households.flatMap(h => h.members).filter(m => m.hardcoverConnected && m.id !== currentUser.id)
    const uniqueMembers = [...new Map(allMembers.map(m => [m.id, m])).values()]
    uniqueMembers.forEach(m => fetchMemberBooks(m.id))

    fetch('/api/activity')
      .then(r => r.json())
      .then(d => setActivity(d.data || []))
      .catch(console.error)
  }, [hasHousehold, households, fetchMemberBooks, currentUser.id])

  async function createHousehold() {
    if (!householdName.trim()) return
    try {
      const res = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: householdName }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Created "${householdName}"!`)
        setCreateDialogOpen(false)
        window.location.reload()
      } else {
        toast.error(data.error)
      }
    } catch { toast.error('Failed to create household') }
  }

  async function joinHousehold() {
    if (!inviteCode.trim()) return
    try {
      const res = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Joined "${data.householdName}"!`)
        setJoinDialogOpen(false)
        window.location.reload()
      } else {
        toast.error(data.error)
      }
    } catch { toast.error('Failed to join household') }
  }

  // My Reading section — shown on every dashboard view
  function renderMyReading() {
    if (!currentUser.hardcoverConnected) {
      return (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              Connect your Hardcover account to see your books here.
            </p>
            <Link href="/settings">
              <Button variant="outline" size="sm">Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      )
    }

    if (loadingMyBooks) {
      return (
        <Card>
          <CardHeader><CardTitle className="text-lg">My Reading</CardTitle></CardHeader>
          <CardContent><MemberCardSkeleton /></CardContent>
        </Card>
      )
    }

    if (!myBooks) return null

    return (
      <div className="space-y-6">
        {/* Currently Reading */}
        {myBooks.reading.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Currently Reading
              </CardTitle>
              <CardDescription>{myBooks.reading.length} {myBooks.reading.length === 1 ? 'book' : 'books'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myBooks.reading.map((ub: any) => {
                  const read = ub.user_book_reads?.[0]
                  return (
                    <Link key={ub.id} href={`/book/${ub.book.id}`} className="block">
                      <BookCard
                        book={ub.book}
                        progress={read?.progress}
                        progressPages={read?.progress_pages}
                        compact
                      />
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recently Finished */}
        {myBooks.finished.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Recently Finished
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myBooks.finished.map((ub: any) => (
                  <Link key={ub.id} href={`/book/${ub.book.id}`} className="block">
                    <BookCard book={ub.book} rating={ub.rating} compact />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {myBooks.reading.length === 0 && myBooks.finished.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <BookMarked className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No reading activity on Hardcover yet. Start tracking a book there and it will show up here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  if (!hasHousehold) {
    return (
      <div className="space-y-8">
        {/* My Reading — always visible */}
        <div>
          <h2 className="text-2xl font-bold mb-4">My Reading</h2>
          {renderMyReading()}
        </div>

        {/* Household prompt — below my reading */}
        <Card className="border-dashed">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">Start a Family Book Club</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Create a household to share your reading with family, or join an existing one with an invite code.
              </p>
              <div className="flex gap-4">
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Household
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create a Household</DialogTitle>
                      <DialogDescription>Give your household a name. You&apos;ll get an invite code to share.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Household Name</Label>
                        <Input
                          placeholder="The Smith Family"
                          value={householdName}
                          onChange={e => setHouseholdName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && createHousehold()}
                        />
                      </div>
                      <Button onClick={createHousehold} className="w-full">Create</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">Join Household</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Join a Household</DialogTitle>
                      <DialogDescription>Enter the invite code shared by a family member.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Invite Code</Label>
                        <Input
                          placeholder="ABCD1234"
                          value={inviteCode}
                          onChange={e => setInviteCode(e.target.value.toUpperCase())}
                          onKeyDown={e => e.key === 'Enter' && joinHousehold()}
                        />
                      </div>
                      <Button onClick={joinHousehold} className="w-full">Join</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* My Reading — always at the top */}
      <div>
        <h2 className="text-2xl font-bold mb-4">My Reading</h2>
        {renderMyReading()}
      </div>

      {/* Household sections */}
      {households.map(household => (
        <div key={household.id}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">{household.name}</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 font-mono text-xs">
                {household.inviteCode}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  navigator.clipboard.writeText(household.inviteCode)
                  toast.success('Invite code copied!')
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {household.members.filter(m => m.id !== currentUser.id).map(member => (
              <Card key={member.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/person/${member.id}`}>
                      <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                        <AvatarImage src={member.avatarUrl || undefined} />
                        <AvatarFallback>
                          {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div>
                      <Link href={`/person/${member.id}`} className="hover:underline">
                        <CardTitle className="text-base">{member.name}</CardTitle>
                      </Link>
                      <CardDescription className="text-xs">
                        {member.hardcoverConnected ? (
                          <span className="text-green-600 dark:text-green-400">@{member.hardcoverUsername}</span>
                        ) : (
                          <span className="text-muted-foreground">Hardcover not connected</span>
                        )}
                      </CardDescription>
                    </div>
                    {member.role === 'admin' && (
                      <Badge variant="secondary" className="ml-auto text-xs">Admin</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!member.hardcoverConnected ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Waiting for Hardcover connection
                    </p>
                  ) : loadingMembers.has(member.id) ? (
                    <div className="space-y-2">
                      <MemberCardSkeleton />
                    </div>
                  ) : memberBooks[member.id] ? (
                    <div className="space-y-4">
                      {memberBooks[member.id].reading.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            Currently Reading
                          </h4>
                          <div className="space-y-1">
                            {memberBooks[member.id].reading.slice(0, 3).map((ub: any) => {
                              const read = ub.user_book_reads?.[0]
                              return (
                                <Link key={ub.id} href={`/book/${ub.book.id}`} className="block">
                                  <BookCard
                                    book={ub.book}
                                    progress={read?.progress}
                                    progressPages={read?.progress_pages}
                                    compact
                                  />
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {memberBooks[member.id].finished.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-2">Recently Finished</h4>
                          <div className="space-y-1">
                            {memberBooks[member.id].finished.slice(0, 2).map((ub: any) => (
                              <Link key={ub.id} href={`/book/${ub.book.id}`} className="block">
                                <BookCard book={ub.book} rating={ub.rating} compact />
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {memberBooks[member.id].reading.length === 0 && memberBooks[member.id].finished.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No reading activity yet
                        </p>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Activity Feed */}
      {activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity.map((item: any) => (
                <div key={item.id} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
                  <Avatar className="h-8 w-8 mt-0.5">
                    <AvatarImage src={item.user?.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {item.user?.name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{item.user?.name}</span>
                      {item.type === 'recommendation' && (
                        <> recommended <span className="font-medium">{item.bookTitle}</span> to <span className="font-medium">{item.targetUser?.name}</span></>
                      )}
                      {item.type === 'plus_one' && (
                        <> added <span className="font-medium">{item.bookTitle}</span> to their wishlist</>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
