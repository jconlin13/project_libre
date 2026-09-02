'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, Star, BookOpenCheck, Send, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import { getAvatarEmoji } from '@/lib/avatar-icons'

interface Person {
  id: string
  name: string
  avatarUrl: string | null
  avatarIcon: string | null
}

interface OverlapPair {
  hardcoverBookId: string
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
  person: Person
  group: { id: string; name: string }
}

interface FavoriteBook {
  hardcoverBookId: string
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
  topScore: number
  lovedBy: Array<Person & { displayScore: number; rank: number; outOf: number }>
}

export function PersonAvatar({ person, size = 'h-6 w-6' }: { person: Person; size?: string }) {
  const emoji = getAvatarEmoji(person.avatarIcon)
  return (
    <Avatar className={size}>
      <AvatarImage src={person.avatarUrl || undefined} />
      <AvatarFallback className={emoji ? 'text-xs' : 'text-[9px]'}>
        {emoji || person.name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

export function CoverThumb({ url, title, className = 'h-16 w-11' }: { url: string | null; title: string | null; className?: string }) {
  return (
    <div className={`relative ${className} flex-shrink-0 overflow-hidden rounded bg-muted`}>
      {url && (
        <Image src={url} alt={title || ''} fill className="object-cover" sizes="88px" unoptimized />
      )}
    </div>
  )
}

/**
 * Spotlights one book at a time that the viewer and one specific group member
 * both want to read, with a one-tap nudge to that person. Scales past two
 * members because each pairing is its own moment rather than a merged list.
 */
export function ReadTogetherSpotlight({ groupId }: { groupId?: string }) {
  const [pairs, setPairs] = useState<OverlapPair[]>([])
  const [index, setIndex] = useState(0)
  const [sending, setSending] = useState(false)
  const [sentKeys, setSentKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    const url = groupId
      ? `/api/discovery/tbr-overlap?groupId=${groupId}`
      : '/api/discovery/tbr-overlap'
    fetch(url)
      .then(r => r.json())
      .then(d => setPairs(d.data || []))
      .catch(() => {})
  }, [groupId])

  const current = pairs[index]
  const pairKey = current ? `${current.hardcoverBookId}:${current.person.id}` : ''
  const alreadySent = sentKeys.has(pairKey)

  const suggest = useCallback(async () => {
    if (!current) return
    setSending(true)
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: current.person.id,
          hardcoverBookId: current.hardcoverBookId,
          bookTitle: current.bookTitle,
          bookAuthor: current.bookAuthor,
          bookCoverUrl: current.bookCoverUrl,
          note: `We both want to read this — want to read it together?`,
        }),
      })
      if (res.ok) {
        toast.success(`Suggested to ${current.person.name.split(' ')[0]}!`)
        setSentKeys(prev => new Set(prev).add(pairKey))
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to send suggestion')
      }
    } catch {
      toast.error('Failed to send suggestion')
    } finally {
      setSending(false)
    }
  }, [current, pairKey])

  if (pairs.length === 0) return null

  const firstName = current.person.name.split(' ')[0]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Read It Together
          </CardTitle>
          {pairs.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">
                {index + 1} of {pairs.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIndex(i => (i - 1 + pairs.length) % pairs.length)}
                aria-label="Previous suggestion"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIndex(i => (i + 1) % pairs.length)}
                aria-label="Next suggestion"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <Link href={`/book/${current.hardcoverBookId}`} className="flex-shrink-0">
            <CoverThumb url={current.bookCoverUrl} title={current.bookTitle} className="h-28 w-20" />
          </Link>
          <div className="min-w-0 flex-1 flex flex-col">
            <Link href={`/book/${current.hardcoverBookId}`} className="hover:underline">
              <p className="font-semibold leading-tight">{current.bookTitle}</p>
            </Link>
            <p className="text-sm text-muted-foreground">{current.bookAuthor}</p>
            <div className="flex items-center gap-2 mt-2">
              <PersonAvatar person={current.person} size="h-6 w-6" />
              <span className="text-sm">
                You and <span className="font-medium">{firstName}</span> both want to read this
              </span>
            </div>
            {!groupId && (
              <Badge variant="outline" className="mt-2 w-fit text-xs font-normal">
                {current.group.name}
              </Badge>
            )}
            <Button
              size="sm"
              className="mt-3 w-fit gap-1.5"
              onClick={suggest}
              disabled={sending || alreadySent}
            >
              <Send className="h-3.5 w-3.5" />
              {alreadySent ? `Suggested to ${firstName}` : `Suggest to ${firstName}`}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Highest-ranked books among group members that the viewer hasn't touched. */
export function LovedByGroup({ groupId }: { groupId?: string }) {
  const [favorites, setFavorites] = useState<FavoriteBook[]>([])

  useEffect(() => {
    const url = groupId
      ? `/api/discovery/household-favorites?groupId=${groupId}`
      : '/api/discovery/household-favorites'
    fetch(url)
      .then(r => r.json())
      .then(d => setFavorites(d.data || []))
      .catch(() => {})
  }, [groupId])

  if (favorites.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Loved by Your Group
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {favorites.slice(0, 4).map(book => {
          const top = [...book.lovedBy].sort((a, b) => b.displayScore - a.displayScore)
          return (
            <Link
              key={book.hardcoverBookId}
              href={`/book/${book.hardcoverBookId}`}
              className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
            >
              <CoverThumb url={book.bookCoverUrl} title={book.bookTitle} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{book.bookTitle}</p>
                <p className="text-xs text-muted-foreground truncate">{book.bookAuthor}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Star className="h-3 w-3 fill-current" />
                    {book.topScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {top.slice(0, 2).map(l => `${l.name.split(' ')[0]}'s #${l.rank} of ${l.outOf}`).join(' · ')}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}

interface YearCounts {
  year: number
  total: number
  members: Array<{ userId: string; name: string; avatarUrl: string | null; avatarIcon: string | null; count: number }>
}

export function YearGoalsCard() {
  const [counts, setCounts] = useState<YearCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/discovery/year-counts')
      .then(r => r.json())
      .then(d => setCounts(d.data || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    )
  }

  if (!counts) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpenCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No reading data yet this year.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpenCheck className="h-5 w-5 text-primary" />
          Books Read in {counts.year}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-4">
          <p className="text-5xl font-bold">{counts.total}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.total === 1 ? 'book' : 'books'} read together as a group
          </p>
        </div>
        {counts.members.length > 0 && (
          <div className="mt-4 space-y-2">
            {counts.members.map(m => (
              <div key={m.userId} className="flex items-center gap-3">
                <PersonAvatar person={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl, avatarIcon: m.avatarIcon }} />
                <span className="text-sm flex-1 truncate">{m.name}</span>
                <span className="text-sm text-muted-foreground">
                  {m.count} {m.count === 1 ? 'book' : 'books'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
