'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sparkles, Users, Star, BookOpenCheck } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { getAvatarEmoji } from '@/lib/avatar-icons'

interface Person {
  userId: string
  name: string
  avatarUrl: string | null
  avatarIcon: string | null
}

interface OverlapBook {
  hardcoverBookId: string
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
  wanters: Person[]
  includesMe: boolean
}

interface FavoriteBook {
  hardcoverBookId: string
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
  topScore: number
  lovedBy: Array<Person & { displayScore: number; rank: number; outOf: number }>
}

function PersonAvatar({ person, size = 'h-6 w-6' }: { person: Person; size?: string }) {
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

function CoverThumb({ url, title }: { url: string | null; title: string | null }) {
  return (
    <div className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded bg-muted">
      {url && (
        <Image src={url} alt={title || ''} fill className="object-cover" sizes="44px" unoptimized />
      )}
    </div>
  )
}

function wantersLabel(book: OverlapBook, currentUserId: string): string {
  const others = book.wanters.filter(w => w.userId !== currentUserId).map(w => w.name.split(' ')[0])
  if (book.includesMe) {
    if (others.length === 1) return `You and ${others[0]} both want to read this`
    if (others.length === 2) return `You, ${others[0]}, and ${others[1]} all want to read this`
    return `You and ${others.length} others want to read this`
  }
  if (others.length === 2) return `${others[0]} and ${others[1]} both want to read this`
  return `${others.slice(0, 2).join(', ')} and ${others.length - 2} more want to read this`
}

function lovedByLabel(book: FavoriteBook): string {
  const parts = book.lovedBy
    .sort((a, b) => b.displayScore - a.displayScore)
    .slice(0, 2)
    .map(l => `${l.name.split(' ')[0]}'s #${l.rank} of ${l.outOf}`)
  return parts.join(' · ')
}

export function DiscoveryModule({ currentUserId }: { currentUserId: string }) {
  const [overlaps, setOverlaps] = useState<OverlapBook[]>([])
  const [favorites, setFavorites] = useState<FavoriteBook[]>([])

  useEffect(() => {
    fetch('/api/discovery/tbr-overlap')
      .then(r => r.json())
      .then(d => setOverlaps(d.data || []))
      .catch(() => {})
    fetch('/api/discovery/household-favorites')
      .then(r => r.json())
      .then(d => setFavorites(d.data || []))
      .catch(() => {})
  }, [])

  if (overlaps.length === 0 && favorites.length === 0) return null

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {overlaps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              You Both Want This
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overlaps.slice(0, 4).map(book => (
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
                    <div className="flex -space-x-1.5">
                      {book.wanters.slice(0, 3).map(w => (
                        <PersonAvatar key={w.userId} person={w} size="h-5 w-5" />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {wantersLabel(book, currentUserId)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {favorites.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Loved by Your Household
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {favorites.slice(0, 4).map(book => (
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
                      {lovedByLabel(book)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface YearCounts {
  year: number
  total: number
  members: Array<Person & { count: number }>
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
            {counts.total === 1 ? 'book' : 'books'} read together as a household
          </p>
        </div>
        {counts.members.length > 0 && (
          <div className="mt-4 space-y-2">
            {counts.members.map(m => (
              <div key={m.userId} className="flex items-center gap-3">
                <PersonAvatar person={m} />
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
