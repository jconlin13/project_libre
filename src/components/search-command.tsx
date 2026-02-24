'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Check, Loader2, BookOpen, Users, PenTool, ArrowRight, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { VisuallyHidden } from 'radix-ui'
import { type BookType, type SearchResult, getBookCover, getAuthor } from '@/lib/types'

type SearchTab = 'all' | 'books' | 'authors' | 'users'

const TABS: { id: SearchTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'books', label: 'Books' },
  { id: 'authors', label: 'Authors' },
  { id: 'users', label: 'Users' },
]

const STATUS_NAMES: Record<number, string> = {
  1: 'Want to Read',
  2: 'Currently Reading',
  3: 'Read',
  5: 'Did Not Finish',
}

interface SearchCommandProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<SearchTab>('all')
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
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&tab=${tab}`, { signal: controller.signal })
      const data = await res.json()
      if (!res.ok) {
        console.error('Search API error:', data.error)
        toast.error(data.error || 'Search failed')
        setResults(null)
        return
      }
      setResults(data.data || null)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 3) {
      setResults(null)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => doSearch(query, activeTab), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, activeTab, doSearch])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults(null)
      setAddedBooks(new Set())
      setActiveTab('all')
    }
  }, [open])

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  function navigateTo(path: string) {
    onOpenChange(false)
    router.push(path)
  }

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

  function renderAddButton(bookId: number) {
    if (addedBooks.has(bookId)) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-primary shrink-0">
          <Check className="h-3 w-3" />
          Added
        </span>
      )
    }
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleAddBook(bookId)
        }}
        disabled={addingBooks.has(bookId)}
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
      >
        {addingBooks.has(bookId) ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Plus className="h-3 w-3" />
        )}
        Add
      </button>
    )
  }

  function renderBookRow(book: BookType, keyPrefix: string) {
    return (
      <div
        key={`${keyPrefix}-${book.id}`}
        className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
      >
        <button
          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
          onClick={() => navigateTo(`/book/${book.id}`)}
        >
          <Image
            src={getBookCover(book)}
            alt=""
            width={28}
            height={42}
            className="rounded object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{book.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {getAuthor(book)}
            </p>
          </div>
        </button>
        {renderAddButton(book.id)}
      </div>
    )
  }

  const hasMyBooks = results && results.myBooks.length > 0
  const hasRecommended = results && results.recommendedBooks && results.recommendedBooks.length > 0
  const hasHardcover = results && results.hardcoverResults.length > 0
  const hasAuthorBooks = results && results.authorBookResults && results.authorBookResults.length > 0
  const hasNetwork = results && results.networkBooks.length > 0
  const hasUsers = results && results.matchedUsers && results.matchedUsers.length > 0
  const hasAnyResults = hasMyBooks || hasRecommended || hasHardcover || hasAuthorBooks || hasNetwork || hasUsers
  const showTabs = query.trim().length >= 3

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <VisuallyHidden.Root>
          <DialogTitle>Search books</DialogTitle>
        </VisuallyHidden.Root>
        {/* Search input */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim().length >= 3) {
                navigateTo(`/search?q=${encodeURIComponent(query.trim())}&tab=${activeTab}`)
              }
            }}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-11"
          />
          {loading && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Tab bar */}
        {showTabs && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-b">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
          {query.trim().length >= 3 && !loading && !hasAnyResults && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}

          {/* My Books section (All + Books tabs) */}
          {hasMyBooks && (activeTab === 'all' || activeTab === 'books') && (
            <div className="px-2 py-1.5">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <BookOpen className="h-3 w-3" />
                My Books
              </div>
              {results!.myBooks.map((ub) => (
                <button
                  key={`my-${ub.book.id}`}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => navigateTo(`/book/${ub.book.id}`)}
                >
                  <Image
                    src={getBookCover(ub.book)}
                    alt=""
                    width={28}
                    height={42}
                    className="rounded object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ub.book.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getAuthor(ub.book)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {STATUS_NAMES[ub.status_id] || 'Unknown'}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {/* Recommended for You section (after My Books, before catalog) */}
          {hasRecommended && (activeTab === 'all' || activeTab === 'books') && (
            <div className="px-2 py-1.5">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ThumbsUp className="h-3 w-3" />
                Recommended for You
              </div>
              {results!.recommendedBooks.map((rec) => (
                <button
                  key={`rec-${rec.id}`}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => navigateTo(`/book/${rec.hardcoverBookId}`)}
                >
                  <Image
                    src={rec.bookCoverUrl || '/book-placeholder.svg'}
                    alt=""
                    width={28}
                    height={42}
                    className="rounded object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rec.bookTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {rec.bookAuthor || 'Unknown Author'}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    from {rec.fromUser.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Hardcover catalog section (All + Books tabs) */}
          {hasHardcover && (activeTab === 'all' || activeTab === 'books') && (
            <div className="px-2 py-1.5">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3 w-3" />
                Books
              </div>
              {results!.hardcoverResults.map((book) => renderBookRow(book, 'hc'))}
            </div>
          )}

          {/* Author book results (Authors tab) */}
          {hasAuthorBooks && activeTab === 'authors' && (
            <div className="px-2 py-1.5">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <PenTool className="h-3 w-3" />
                Books by Author
              </div>
              {results!.authorBookResults.map((book) => renderBookRow(book, 'author'))}
            </div>
          )}

          {/* Matched Users section (All + Users tabs) */}
          {hasUsers && (activeTab === 'all' || activeTab === 'users') && (
            <div className="px-2 py-1.5">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                People
              </div>
              {results!.matchedUsers.map((u) => (
                <button
                  key={`user-${u.id}`}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => navigateTo(`/person/${u.id}`)}
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden">
                    {u.avatarUrl ? (
                      <Image src={u.avatarUrl} alt="" width={28} height={28} className="object-cover" />
                    ) : (
                      u.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{u.name}</p>
                </button>
              ))}
            </div>
          )}

          {/* Network section (All tab only) */}
          {hasNetwork && activeTab === 'all' && (
            <div className="px-2 py-1.5">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <BookOpen className="h-3 w-3" />
                In Your Network
              </div>
              {results!.networkBooks.map((nb, i) => (
                <button
                  key={`net-${nb.book.id}-${nb.member.id}-${i}`}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => navigateTo(`/person/${nb.member.id}`)}
                >
                  <Image
                    src={getBookCover(nb.book)}
                    alt=""
                    width={28}
                    height={42}
                    className="rounded object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{nb.book.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {nb.member.name} {nb.statusLabel} this
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* See All Results button */}
        {query.trim().length >= 3 && (
          <div className="border-t px-3 py-2">
            <button
              onClick={() => navigateTo(`/search?q=${encodeURIComponent(query.trim())}&tab=${activeTab}`)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-sm text-primary hover:bg-muted transition-colors cursor-pointer"
            >
              See All Results
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
