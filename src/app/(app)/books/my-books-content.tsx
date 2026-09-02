'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BookCover } from '@/components/book-cover'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookOpen, CheckCircle, Heart, XCircle, Newspaper, Star, Search, Library, Upload } from 'lucide-react'
import { ReadsContent } from '@/app/(app)/reads/reads-content'

interface LibraryBook {
  hardcoverBookId: string
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
  statusId: number | null
  rating: number | null
  progressPct: number | null
  lastReadDate: string | null
  isRanked: boolean
  isHardcover: boolean
}

interface Library {
  currentlyReading: LibraryBook[]
  read: LibraryBook[]
  wantToRead: LibraryBook[]
  didNotFinish: LibraryBook[]
  total: number
  hasHardcover: boolean
}

type Tab = 'currently-reading' | 'read' | 'want-to-read' | 'not-finished' | 'articles'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'currently-reading', label: 'Currently Reading', icon: BookOpen },
  { id: 'read', label: 'Read', icon: CheckCircle },
  { id: 'want-to-read', label: 'Want to Read', icon: Heart },
  { id: 'not-finished', label: 'Not Finished', icon: XCircle },
  { id: 'articles', label: 'Articles', icon: Newspaper },
]

function BookTile({ book }: { book: LibraryBook }) {
  return (
    <Link
      href={`/book/${book.hardcoverBookId}`}
      className="group flex flex-col gap-2 rounded-lg p-2 -m-2 hover:bg-muted/50 transition-colors"
    >
      <BookCover
        url={book.bookCoverUrl}
        title={book.bookTitle}
        author={book.bookAuthor}
        className="aspect-[2/3] w-full"
        sizes="(max-width: 640px) 33vw, 150px"
      />
      <div className="min-w-0">
        <p className="text-xs font-medium leading-tight line-clamp-2">{book.bookTitle}</p>
        <p className="text-[11px] text-muted-foreground truncate">{book.bookAuthor}</p>
        {book.rating != null && book.rating > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
            <Star className="h-2.5 w-2.5 fill-current" />
            {book.rating}
          </span>
        )}
        {book.progressPct != null && book.progressPct > 0 && book.statusId === 2 && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, book.progressPct)}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground">{Math.round(book.progressPct)}%</span>
          </div>
        )}
      </div>
    </Link>
  )
}

export function MyBooksContent({ userId, initialTab }: { userId: string; initialTab?: string }) {
  const [library, setLibrary] = useState<Library | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>(
    TABS.some(t => t.id === initialTab) ? (initialTab as Tab) : 'currently-reading'
  )
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/library')
      .then(r => r.json())
      .then(d => setLibrary(d.data || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const listFor = (t: Tab): LibraryBook[] => {
    if (!library) return []
    switch (t) {
      case 'currently-reading': return library.currentlyReading
      case 'read': return library.read
      case 'want-to-read': return library.wantToRead
      case 'not-finished': return library.didNotFinish
      default: return []
    }
  }

  const books = listFor(tab)
  const filtered = query.trim()
    ? books.filter(b =>
        (b.bookTitle || '').toLowerCase().includes(query.toLowerCase()) ||
        (b.bookAuthor || '').toLowerCase().includes(query.toLowerCase())
      )
    : books

  const countFor = (t: Tab) => (t === 'articles' ? null : listFor(t).length)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Books</h1>
          <p className="text-muted-foreground text-sm">
            {library ? `${library.total} books in your library` : 'Your library'}
          </p>
        </div>
        {library && library.total === 0 && (
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Import Library
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b pb-2 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          const count = countFor(t.id)
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                tab === t.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {count != null && count > 0 && (
                <span className={`text-xs ${tab === t.id ? 'opacity-80' : 'text-muted-foreground'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'articles' ? (
        <ReadsContent userId={userId} />
      ) : loading ? (
        <p className="text-muted-foreground">Loading your library...</p>
      ) : books.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Library className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Nothing on this shelf yet.
            </p>
            <Link href="/settings">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Import from Goodreads
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {books.length > 12 && (
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search this shelf..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No books match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {filtered.map(b => (
                <BookTile key={b.hardcoverBookId} book={b} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
