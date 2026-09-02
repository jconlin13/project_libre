'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { BookCardSkeleton } from '@/components/loading-skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Search, Heart, Check, X, Plus, Star, Quote } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import Link from 'next/link'
import { ReadTogetherSpotlight, LovedByGroup, PersonAvatar } from '@/components/discovery-module'

interface Person {
  id: string
  name: string
  avatarUrl: string | null
  avatarIcon: string | null
}

interface Recommendation {
  id: string
  hardcoverBookId: string
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
  note: string | null
  status: string
  createdAt: string
  fromUser: { id: string; name: string; avatarUrl: string | null; avatarIcon: string | null }
  toUser: { id: string; name: string; avatarUrl: string | null; avatarIcon: string | null }
  // Context added server-side for received recommendations
  senderRating?: { displayScore: number; rank: number; outOf: number } | null
  alsoHave?: Array<{ user: Person; statusId: number | null; rating: number | null }>
}

const STATUS_TEXT: Record<number, string> = {
  1: 'wants to read it',
  2: 'is reading it',
  3: 'read it',
}

interface RecommendationsContentProps {
  userId: string
  hardcoverConnected: boolean
}

export function RecommendationsContent({ userId, hardcoverConnected }: RecommendationsContentProps) {
  const [received, setReceived] = useState<Recommendation[]>([])
  const [sent, setSent] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedBook, setSelectedBook] = useState<any>(null)
  const [selectedRecipient, setSelectedRecipient] = useState('')
  const [note, setNote] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchRecommendations()
    fetchMembers()
  }, [])

  async function fetchRecommendations() {
    try {
      const res = await fetch('/api/recommendations')
      const data = await res.json()
      if (data.data) {
        setReceived(data.data.received || [])
        setSent(data.data.sent || [])
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMembers() {
    try {
      const res = await fetch('/api/households')
      const data = await res.json()
      if (data.data) {
        const allMembers = data.data.flatMap((h: any) => h.members).filter((m: any) => m.id !== userId)
        setMembers([...new Map(allMembers.map((m: any) => [m.id, m])).values()])
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
    }
  }

  async function searchBooks() {
    if (!searchQuery.trim() || !hardcoverConnected) return
    setSearching(true)
    try {
      const res = await fetch(`/api/hardcover?action=search&q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data.data || [])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  async function createRecommendation() {
    if (!selectedBook || !selectedRecipient) {
      toast.error('Select a book and recipient')
      return
    }
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: selectedRecipient,
          hardcoverBookId: String(selectedBook.id),
          bookTitle: selectedBook.title,
          bookAuthor: selectedBook.cached_contributors?.[0]?.author?.name || 'Unknown',
          bookCoverUrl: selectedBook.cached_image || null,
          note: note || null,
        }),
      })
      if (res.ok) {
        toast.success('Recommendation sent!')
        setDialogOpen(false)
        setSelectedBook(null)
        setSelectedRecipient('')
        setNote('')
        setSearchResults([])
        setSearchQuery('')
        fetchRecommendations()
      } else {
        const data = await res.json()
        toast.error(data.error)
      }
    } catch { toast.error('Failed to send recommendation') }
  }

  async function updateRecommendation(id: string, status: string) {
    try {
      const res = await fetch('/api/recommendations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        toast.success(status === 'accepted' ? 'Recommendation accepted!' : 'Recommendation dismissed')
        fetchRecommendations()
      }
    } catch { toast.error('Failed to update') }
  }

  async function plusOneBook(rec: Recommendation) {
    try {
      const res = await fetch('/api/plus-ones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hardcoverBookId: rec.hardcoverBookId,
          bookTitle: rec.bookTitle,
          bookAuthor: rec.bookAuthor,
          bookCoverUrl: rec.bookCoverUrl,
        }),
      })
      if (res.ok) {
        toast.success('Added to your wishlist!')
        updateRecommendation(rec.id, 'accepted')
      }
    } catch { toast.error('Failed to add') }
  }

  const pendingReceived = received.filter(r => r.status === 'pending')
  const pastReceived = received.filter(r => r.status !== 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recommendations</h1>
          <p className="text-muted-foreground">Books your group thinks you&apos;ll love</p>
        </div>
        {hardcoverConnected && members.length > 0 && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Heart className="mr-2 h-4 w-4" />
                Recommend a Book
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Recommend a Book</DialogTitle>
                <DialogDescription>Search for a book and recommend it to a group member.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search for a book..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchBooks()}
                  />
                  <Button onClick={searchBooks} disabled={searching} size="icon">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {searchResults.length > 0 && !selectedBook && (
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded border p-2">
                    {searchResults.map((book: any) => (
                      <button
                        key={book.id}
                        className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-muted"
                        onClick={() => setSelectedBook(book)}
                      >
                        {book.cached_image && (
                          <Image src={book.cached_image} alt="" width={32} height={48} className="rounded object-cover" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{book.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {book.cached_contributors?.[0]?.author?.name || 'Unknown'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedBook && (
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    {selectedBook.cached_image && (
                      <Image src={selectedBook.cached_image} alt="" width={40} height={60} className="rounded object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedBook.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {selectedBook.cached_contributors?.[0]?.author?.name || 'Unknown'}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedBook(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Recommend to</Label>
                  <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a group member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Note (optional)</Label>
                  <Textarea
                    placeholder="I think you'd love this because..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                  />
                </div>

                <Button onClick={createRecommendation} className="w-full" disabled={!selectedBook || !selectedRecipient}>
                  Send Recommendation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Passive discovery — books surfaced from your groups without anyone
          having to send a recommendation */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ReadTogetherSpotlight />
        <LovedByGroup />
      </div>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received" className="gap-2">
            Received
            {pendingReceived.length > 0 && (
              <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                {pendingReceived.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4 mt-4">
          {loading ? (
            [1, 2, 3].map(i => <BookCardSkeleton key={i} />)
          ) : pendingReceived.length === 0 && pastReceived.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Heart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No recommendations yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {pendingReceived.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Pending</h3>
                  {pendingReceived.map(rec => {
                    const senderFirst = rec.fromUser.name.split(' ')[0]
                    return (
                      <Card key={rec.id} className="overflow-hidden">
                        <div className="flex gap-4 p-4">
                          <Link href={`/book/${rec.hardcoverBookId}`} className="flex-shrink-0">
                            <div className="relative h-32 w-22 overflow-hidden rounded bg-muted" style={{ width: '5.5rem' }}>
                              {rec.bookCoverUrl && (
                                <Image src={rec.bookCoverUrl} alt={rec.bookTitle || ''} fill className="object-cover" sizes="88px" unoptimized />
                              )}
                            </div>
                          </Link>

                          <div className="flex-1 min-w-0">
                            <Link href={`/book/${rec.hardcoverBookId}`} className="hover:underline">
                              <p className="font-semibold leading-tight">{rec.bookTitle}</p>
                            </Link>
                            <p className="text-sm text-muted-foreground">{rec.bookAuthor}</p>

                            {/* Lead with the sender's own words when they left any */}
                            {rec.note && (
                              <div className="flex gap-1.5 mt-2 text-sm">
                                <Quote className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                                <p className="italic">{rec.note}</p>
                              </div>
                            )}

                            {/* Why you might read it: how the sender ranked it */}
                            <div className="flex items-center gap-2 mt-2">
                              <PersonAvatar person={{ ...rec.fromUser, avatarIcon: rec.fromUser.avatarIcon ?? null }} size="h-5 w-5" />
                              <span className="text-xs text-muted-foreground">
                                from <span className="font-medium text-foreground">{senderFirst}</span>
                              </span>
                              {rec.senderRating && (
                                <>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                    <Star className="h-3 w-3 fill-current" />
                                    {rec.senderRating.displayScore.toFixed(1)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    their #{rec.senderRating.rank} of {rec.senderRating.outOf}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Who else in the group has it */}
                            {rec.alsoHave && rec.alsoHave.length > 0 && (
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <div className="flex -space-x-1.5">
                                  {rec.alsoHave.slice(0, 4).map(a => (
                                    <PersonAvatar key={a.user.id} person={a.user} size="h-5 w-5" />
                                  ))}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {rec.alsoHave.length === 1
                                    ? `${rec.alsoHave[0].user.name.split(' ')[0]} ${STATUS_TEXT[rec.alsoHave[0].statusId ?? 1] || 'has it'}`
                                    : `${rec.alsoHave.length} others in your group have it`}
                                </span>
                              </div>
                            )}

                            <div className="flex gap-2 mt-3">
                              <Button size="sm" className="h-7 gap-1" onClick={() => plusOneBook(rec)}>
                                <Plus className="h-3 w-3" />
                                Add to Wishlist
                              </Button>
                              <Button size="sm" variant="outline" className="h-7" onClick={() => updateRecommendation(rec.id, 'accepted')}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => updateRecommendation(rec.id, 'dismissed')}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
              {pastReceived.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Past</h3>
                  {pastReceived.map(rec => (
                    <Card key={rec.id} className="overflow-hidden opacity-75">
                      <div className="flex gap-4 p-4">
                        <Link href={`/book/${rec.hardcoverBookId}`} className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded bg-muted">
                          {rec.bookCoverUrl && (
                            <Image src={rec.bookCoverUrl} alt={rec.bookTitle || ""} fill className="object-cover" sizes="44px" unoptimized />
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{rec.bookTitle}</p>
                          <p className="text-xs text-muted-foreground">{rec.bookAuthor}</p>
                          <Badge variant={rec.status === 'accepted' ? 'default' : 'secondary'} className="mt-1 text-xs">
                            {rec.status}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4 mt-4">
          {loading ? (
            [1, 2].map(i => <BookCardSkeleton key={i} />)
          ) : sent.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Heart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">You haven&apos;t sent any recommendations yet</p>
              </CardContent>
            </Card>
          ) : (
            sent.map(rec => (
              <Card key={rec.id} className="overflow-hidden">
                <div className="flex gap-4 p-4">
                  <Link href={`/book/${rec.hardcoverBookId}`} className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded bg-muted">
                          {rec.bookCoverUrl && (
                            <Image src={rec.bookCoverUrl} alt={rec.bookTitle || ""} fill className="object-cover" sizes="44px" unoptimized />
                          )}
                        </Link>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{rec.bookTitle}</p>
                    <p className="text-xs text-muted-foreground">{rec.bookAuthor}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">to {rec.toUser.name}</span>
                      <Badge variant={rec.status === 'accepted' ? 'default' : rec.status === 'dismissed' ? 'secondary' : 'outline'} className="text-xs">
                        {rec.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
