'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, BookOpen, Users, PenTool, Bookmark, Check } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import Link from 'next/link'
import { type BookType, type SearchResult, getBookCover, getAuthor } from '@/lib/types'

type SearchTab = 'all' | 'books' | 'authors' | 'users'

const TABS: { id: SearchTab; label: string; icon: typeof Search }[] = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'books', label: 'Books', icon: BookOpen },
  { id: 'authors', label: 'Authors', icon: PenTool },
  { id: 'users', label: 'Users', icon: Users },
]

const STATUS_NAMES: Record<number, string> = {
  1: 'Want to Read',
  2: 'Currently Reading',
  3: 'Read',
  5: 'Did Not Finish',
}

export function SearchContent({ hardcoverConnected }: { hardcoverConnected: boolean }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const initialQuery = searchParams.get('q') || ''
  const initialTab = (searchParams.get('tab') as SearchTab) || 'all'

  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [addingBooks, setAddingBooks] = useState<Set<number>>(new Set())
  const [addedBooks, setAddedBooks] = useState<Set<number>>(new Set())
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const doSearch = useCallback(async (q: string, tab: SearchTab) => {
    if (q.trim().length < 3) {
      setResults(null)
      setLoading(false)
      return
    }
    // Abort any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&tab=${tab}&perPage=20`, { signal: controller.signal })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Search failed')
        setResults(null)
        return
      }
      setResults(data.data || null)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  // Search on mount if query param exists
  useEffect(() => {
    if (initialQuery.trim().length >= 3) {
      doSearch(initialQuery, initialTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced search on query/tab change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 3) {
      setResults(null)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => {
      doSearch(query, activeTab)
      // Update URL without navigation
      const params = new URLSearchParams()
      params.set('q', query.trim())
      if (activeTab !== 'all') params.set('tab', activeTab)
      router.replace(`/search?${params.toString()}`, { scroll: false })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, activeTab, doSearch, router])

  async function handleAddBook(bookId: number) {
    setAddingBooks((prev) => new Set(prev).add(bookId))
    try {
      const res = await fetch('/api/hardcover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-book', bookId }),
      })
      if (res.ok) {
        setAddedBooks((prev) => new Set(prev).add(bookId))
        toast.success('Added to Want to Read')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to add book')
      }
    } catch {
      toast.error('Failed to add book')
    } finally {
      setAddingBooks((prev) => {
        const next = new Set(prev)
        next.delete(bookId)
        return next
      })
    }
  }

  function renderAddBookButton(bookId: number) {
    if (addedBooks.has(bookId)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-primary shrink-0">
          <Bookmark className="h-4 w-4 fill-primary" />
          <Check className="h-3 w-3" />
          Added
        </span>
      )
    }
    return (
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleAddBook(bookId)
        }}
        disabled={addingBooks.has(bookId)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
      >
        {addingBooks.has(bookId) ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
        Add to Want to Read
      </button>
    )
  }

  function renderBookCard(book: BookType, keyPrefix: string) {
    const author = getAuthor(book)
    return (
      <Link href={`/book/${book.id}`} key={`${keyPrefix}-${book.id}`}>
        <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex gap-4 p-4">
            <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-md">
              <Image
                src={getBookCover(book)}
                alt={book.title}
                fill
                className="object-cover"
                sizes="64px"
                unoptimized
              />
            </div>
            <div className="flex flex-1 flex-col min-w-0">
              <h3 className="font-semibold truncate">{book.title}</h3>
              <p className="text-sm text-muted-foreground">{author}</p>
              {book.pages && (
                <p className="text-xs text-muted-foreground mt-1">{book.pages} pages</p>
              )}
            </div>
            <div className="flex items-center shrink-0">
              {renderAddBookButton(book.id)}
            </div>
          </div>
        </Card>
      </Link>
    )
  }

  if (!hardcoverConnected) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>Connect your Hardcover account in Settings to search books.</p>
      </div>
    )
  }

  const hasMyBooks = results && results.myBooks.length > 0
  // TODO: Phase 3 — Recommended books section
  // const hasRecommended = results && results.recommendedBooks && results.recommendedBooks.length > 0
  const hasHardcover = results && results.hardcoverResults.length > 0
  const hasAuthorBooks = results && results.authorBookResults && results.authorBookResults.length > 0
  const hasNetwork = results && results.networkBooks.length > 0
  const hasUsers = results && results.matchedUsers && results.matchedUsers.length > 0
  const hasAnyResults = hasMyBooks || /* hasRecommended || */ hasHardcover || hasAuthorBooks || hasNetwork || hasUsers

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Search input */}
      <div className="flex items-center gap-3 border rounded-lg px-4 py-2 bg-background">
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <Input
          ref={inputRef}
          placeholder="Search books, authors, or people..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-base"
          autoFocus
        />
        {loading && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Results */}
      {query.trim().length >= 3 && !loading && !hasAnyResults && (
        <div className="py-12 text-center text-muted-foreground">
          No results found for &ldquo;{query}&rdquo;
        </div>
      )}

      {query.trim().length < 3 && (
        <div className="py-12 text-center text-muted-foreground">
          Type at least 3 characters to search
        </div>
      )}

      {/* My Books section */}
      {hasMyBooks && (activeTab === 'all' || activeTab === 'books') && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            My Books
          </h2>
          <div className="space-y-2">
            {results!.myBooks.map((ub) => (
              <Link href={`/book/${ub.book.id}`} key={`my-${ub.book.id}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex gap-4 p-4">
                    <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-md">
                      <Image
                        src={getBookCover(ub.book)}
                        alt={ub.book.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                        unoptimized
                      />
                    </div>
                    <div className="flex flex-1 flex-col min-w-0">
                      <h3 className="font-semibold truncate">{ub.book.title}</h3>
                      <p className="text-sm text-muted-foreground">{getAuthor(ub.book)}</p>
                      <Badge variant="secondary" className="mt-2 w-fit text-xs">
                        {STATUS_NAMES[ub.status_id] || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* TODO: Phase 3 — Recommended books section (after My Books, before catalog)
      {hasRecommended && (activeTab === 'all' || activeTab === 'books') && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <ThumbsUp className="h-4 w-4" />
            Recommended for You
          </h2>
          <div className="space-y-2">
            {results!.recommendedBooks.map((book) => renderBookCard(book, 'rec'))}
          </div>
        </div>
      )}
      */}

      {/* Hardcover catalog section */}
      {hasHardcover && (activeTab === 'all' || activeTab === 'books') && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Search className="h-4 w-4" />
            Books
          </h2>
          <div className="space-y-2">
            {results!.hardcoverResults.map((book) => renderBookCard(book, 'hc'))}
          </div>
        </div>
      )}

      {/* Author book results */}
      {hasAuthorBooks && activeTab === 'authors' && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <PenTool className="h-4 w-4" />
            Books by Author
          </h2>
          <div className="space-y-2">
            {results!.authorBookResults.map((book) => renderBookCard(book, 'author'))}
          </div>
        </div>
      )}

      {/* Matched Users section */}
      {hasUsers && (activeTab === 'all' || activeTab === 'users') && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            People
          </h2>
          <div className="space-y-2">
            {results!.matchedUsers.map((u) => (
              <Link href={`/person/${u.id}`} key={`user-${u.id}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0 overflow-hidden">
                      {u.avatarUrl ? (
                        <Image src={u.avatarUrl} alt="" width={40} height={40} className="object-cover" />
                      ) : (
                        u.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <p className="font-semibold">{u.name}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Network section */}
      {hasNetwork && activeTab === 'all' && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            In Your Network
          </h2>
          <div className="space-y-2">
            {results!.networkBooks.map((nb, i) => (
              <Link href={`/book/${nb.book.id}`} key={`net-${nb.book.id}-${nb.member.id}-${i}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex gap-4 p-4">
                    <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-md">
                      <Image
                        src={getBookCover(nb.book)}
                        alt={nb.book.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                        unoptimized
                      />
                    </div>
                    <div className="flex flex-1 flex-col min-w-0">
                      <h3 className="font-semibold truncate">{nb.book.title}</h3>
                      <p className="text-sm text-muted-foreground">{getAuthor(nb.book)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {nb.member.name} {nb.statusLabel} this
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
