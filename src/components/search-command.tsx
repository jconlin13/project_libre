'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Check, Loader2, BookOpen, Users } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { VisuallyHidden } from 'radix-ui'

interface SearchResult {
  myBooks: Array<{
    id: number
    status_id: number
    rating: number | null
    book: {
      id: number
      title: string
      slug: string
      cached_image?: { url: string } | null
      cached_contributors?: { author: { name: string } }[]
    }
  }>
  hardcoverResults: Array<{
    id: number
    title: string
    slug: string
    cached_image?: { url: string } | null
    cached_contributors?: { author: { name: string } }[]
  }>
  networkBooks: Array<{
    book: {
      id: number
      title: string
      slug: string
      cached_image?: { url: string } | null
      cached_contributors?: { author: { name: string } }[]
    }
    member: { id: string; name: string }
    statusLabel: string
  }>
}

const STATUS_NAMES: Record<number, string> = {
  1: 'Want to Read',
  2: 'Currently Reading',
  3: 'Read',
  5: 'Did Not Finish',
}

function getBookCover(book: { cached_image?: { url: string } | null }): string {
  return book.cached_image?.url || '/book-placeholder.svg'
}

function getAuthor(book: { cached_contributors?: { author: { name: string } }[] }): string {
  return book.cached_contributors?.[0]?.author?.name || 'Unknown Author'
}

interface SearchCommandProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [addingBooks, setAddingBooks] = useState<Set<number>>(new Set())
  const [addedBooks, setAddedBooks] = useState<Set<number>>(new Set())
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      if (!res.ok) {
        console.error('Search API error:', data.error)
        toast.error(data.error || 'Search failed')
        setResults(null)
        return
      }
      console.log('Search results:', data.data)
      setResults(data.data || null)
    } catch (err) {
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
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doSearch])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults(null)
      setAddedBooks(new Set())
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

  const hasMyBooks = results && results.myBooks.length > 0
  const hasHardcover = results && results.hardcoverResults.length > 0
  const hasNetwork = results && results.networkBooks.length > 0
  const hasAnyResults = hasMyBooks || hasHardcover || hasNetwork

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
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-11"
          />
          {loading && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {query.trim().length >= 3 && !loading && !hasAnyResults && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}

          {/* My Books section */}
          {hasMyBooks && (
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

          {/* Books (Hardcover catalog) section */}
          {hasHardcover && (
            <div className="px-2 py-1.5">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3 w-3" />
                Books
              </div>
              {results!.hardcoverResults.map((book) => (
                <div
                  key={`hc-${book.id}`}
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
                  {addedBooks.has(book.id) ? (
                    <span className="inline-flex items-center gap-1 text-xs text-primary shrink-0">
                      <Check className="h-3 w-3" />
                      Added
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddBook(book.id)
                      }}
                      disabled={addingBooks.has(book.id)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {addingBooks.has(book.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Network section */}
          {hasNetwork && (
            <div className="px-2 py-1.5">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" />
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
      </DialogContent>
    </Dialog>
  )
}
