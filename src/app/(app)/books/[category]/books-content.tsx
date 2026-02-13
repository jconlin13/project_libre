'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LayoutGrid, List, Heart, ThumbsUp, BookOpen, CheckCircle, Clock, XCircle, Library } from 'lucide-react'

interface Book {
  id: number
  title: string
  slug?: string
  cached_image?: { url: string } | string | null
  cached_contributors?: { author: { name: string } }[]
  pages?: number
}

interface UserBook {
  id: number
  status_id: number
  rating: number | null
  date_added?: string
  last_read_date?: string
  book: Book
  user_book_reads?: { progress: number | null; progress_pages: number | null; started_at: string | null }[]
}

const CATEGORIES = [
  { slug: 'all', label: 'All', icon: Library },
  { slug: 'want-to-read', label: 'Want to Read', icon: Heart },
  { slug: 'currently-reading', label: 'Currently Reading', icon: BookOpen },
  { slug: 'read', label: 'Read', icon: CheckCircle },
  { slug: 'not-finished', label: 'Not Finished', icon: XCircle },
] as const

function getApiAction(category: string): string {
  switch (category) {
    case 'want-to-read': return 'want-to-read'
    case 'currently-reading': return 'reading'
    case 'read': return 'finished'
    case 'not-finished': return 'dnf'
    case 'all':
    default: return 'all-books'
  }
}

function getCoverUrl(book: Book): string | null {
  const img = typeof book.cached_image === 'string'
    ? (() => { try { return JSON.parse(book.cached_image as string) } catch { return null } })()
    : book.cached_image
  return img?.url || null
}

function getAuthor(book: Book): string {
  return book.cached_contributors?.[0]?.author?.name || 'Unknown Author'
}

function formatDate(dateStr?: string | null): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

function getDateLabel(ub: UserBook): string | null {
  switch (ub.status_id) {
    case 1: {
      const d = formatDate(ub.date_added)
      return d ? `Added ${d}` : null
    }
    case 2: {
      const started = ub.user_book_reads?.[0]?.started_at
      const d = formatDate(started) || formatDate(ub.date_added)
      return d ? `Started ${d}` : null
    }
    case 3: {
      const d = formatDate(ub.last_read_date)
      return d ? `Finished on ${d}` : null
    }
    case 5: {
      const d = formatDate(ub.date_added)
      return d ? `Added ${d}` : null
    }
    default: {
      const d = formatDate(ub.date_added)
      return d ? `Added ${d}` : null
    }
  }
}

// --- Card View ---
function CardView({ books }: { books: UserBook[] }) {
  return (
    <div className="space-y-3">
      {books.map((ub) => {
        const coverUrl = getCoverUrl(ub.book)
        const author = getAuthor(ub.book)
        const dateLabel = getDateLabel(ub)

        return (
          <Link key={ub.id} href={`/book/${ub.book.id}`} className="block">
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <div className="flex gap-4 p-4">
                <div className="relative h-[120px] w-[80px] flex-shrink-0 overflow-hidden rounded-md">
                  {coverUrl ? (
                    <Image src={coverUrl} alt={ub.book.title} fill className="object-cover" sizes="80px" unoptimized />
                  ) : (
                    <div className="h-full w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      No cover
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col min-w-0">
                  <h3 className="font-semibold truncate">{ub.book.title}</h3>
                  <p className="text-sm text-muted-foreground">{author}</p>
                  {dateLabel && (
                    <p className="text-xs text-muted-foreground mt-1">{dateLabel}</p>
                  )}
                  <div className="mt-auto pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                      disabled
                    >
                      <ThumbsUp className="h-3 w-3" />
                      Recommend
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

// --- Shelf View ---
function ShelfView({ books }: { books: UserBook[] }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
      {books.map((ub) => {
        const coverUrl = getCoverUrl(ub.book)
        const author = getAuthor(ub.book)

        return (
          <Link key={ub.id} href={`/book/${ub.book.id}`} className="block group">
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg shadow-md transition-shadow group-hover:shadow-lg">
              {coverUrl ? (
                <Image src={coverUrl} alt={ub.book.title} fill className="object-cover" sizes="120px" unoptimized />
              ) : (
                <div className="h-full w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  No cover
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                <p className="text-white text-xs font-semibold line-clamp-2 leading-tight">{ub.book.title}</p>
                <p className="text-white/70 text-[10px] line-clamp-1 mt-0.5">{author}</p>
                <button
                  className="mt-1.5 text-[10px] text-white/80 border border-white/30 rounded px-1.5 py-0.5 hover:bg-white/10 transition-colors self-start"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                  disabled
                >
                  <span className="flex items-center gap-0.5">
                    <ThumbsUp className="h-2.5 w-2.5" />
                    Recommend
                  </span>
                </button>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// --- Main Component ---
export function BooksContent({ category, hardcoverConnected }: { category: string; hardcoverConnected: boolean }) {
  const [books, setBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'card' | 'shelf'>('shelf')

  useEffect(() => {
    if (!hardcoverConnected) {
      setLoading(false)
      return
    }

    setLoading(true)
    const action = getApiAction(category)
    const url = action === 'finished'
      ? `/api/hardcover?action=${action}&limit=500`
      : `/api/hardcover?action=${action}`

    fetch(url)
      .then(r => r.json())
      .then(data => setBooks(data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [category, hardcoverConnected])

  const currentCategory = CATEGORIES.find(c => c.slug === category) || CATEGORIES[0]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Category tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 flex-wrap">
          {CATEGORIES.map((cat) => {
            const isActive = cat.slug === category
            const Icon = cat.icon
            return (
              <Link key={cat.slug} href={`/books/${cat.slug}`}>
                <Button
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cat.label}
                </Button>
              </Link>
            )
          })}
        </div>

        {/* View toggle */}
        <div className="flex items-center border rounded-md overflow-hidden flex-shrink-0">
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Card view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('shelf')}
            className={`p-1.5 transition-colors ${viewMode === 'shelf' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Shelf view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!hardcoverConnected ? (
        <div className="text-center py-12">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Connect your Hardcover account in Settings to see your books.</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading books...</p>
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-12">
          <currentCategory.icon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No books in {currentCategory.label.toLowerCase()}.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{books.length} {books.length === 1 ? 'book' : 'books'}</p>
          {viewMode === 'card' ? <CardView books={books} /> : <ShelfView books={books} />}
        </>
      )}
    </div>
  )
}
