'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, BookOpen } from 'lucide-react'
import { AmazonIcon } from '@/components/icons/amazon-icon'
import { LibbyIcon } from '@/components/icons/libby-icon'
import { StarRating } from '@/components/star-rating'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

interface BookDetailContentProps {
  bookId: string
}

export default function BookDetailContent({ bookId }: BookDetailContentProps) {
  const [book, setBook] = useState<any>(null)
  const [readingProgress, setReadingProgress] = useState<{ progress: number | null; progress_pages: number | null } | null>(null)
  const [userRating, setUserRating] = useState<number>(0)
  const [bookActivity, setBookActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Progress tracker state
  const [progressMode, setProgressMode] = useState<'percent' | 'pages'>('percent')
  const [editingProgress, setEditingProgress] = useState(false)
  const [progressInput, setProgressInput] = useState('')
  const [savingProgress, setSavingProgress] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [bookRes, readingRes, finishedRes] = await Promise.all([
          fetch(`/api/hardcover?action=book&bookId=${bookId}`),
          fetch('/api/hardcover?action=reading'),
          fetch('/api/hardcover?action=finished&limit=50'),
        ])

        const bookJson = await bookRes.json()
        const bookData = bookJson.data

        if (!bookData) {
          setNotFound(true)
          return
        }

        setBook(bookData)

        // Parse reading and finished lists once
        const readingBooks = readingRes.ok ? (await readingRes.json()).data || [] : []
        const finishedBooks = finishedRes.ok ? (await finishedRes.json()).data || [] : []

        // Check if currently reading this book
        const readingMatch = readingBooks.find((ub: any) => String(ub.book.id) === bookId)
        if (readingMatch) {
          const read = readingMatch.user_book_reads?.[0]
          if (read) {
            setReadingProgress({ progress: read.progress, progress_pages: read.progress_pages })
          }
        }

        // Check rating from reading or finished books
        const allUserBooks = [...readingBooks, ...finishedBooks]
        const ratedMatch = allUserBooks.find((ub: any) => String(ub.book.id) === bookId)
        if (ratedMatch?.rating) {
          setUserRating(ratedMatch.rating)
        }

        // Build activity timeline from user_book_reads
        const activityItems: any[] = []
        if (ratedMatch) {
          const reads = ratedMatch.user_book_reads || []
          reads.forEach((read: any) => {
            if (read.progress != null && read.progress > 0) {
              activityItems.push({
                type: 'progress',
                value: `${Math.round(read.progress)}%`,
                date: read.started_at,
              })
            }
            if (read.progress_pages != null && read.progress_pages > 0) {
              activityItems.push({
                type: 'pages',
                value: `page ${read.progress_pages}`,
                date: read.started_at,
              })
            }
          })
          if (ratedMatch.rating) {
            activityItems.push({
              type: 'rating',
              value: `${ratedMatch.rating}/5 stars`,
              date: ratedMatch.date_added || ratedMatch.last_read_date,
            })
          }
        }
        setBookActivity(activityItems)
      } catch (error) {
        console.error('Error fetching book:', error)
        toast.error('Failed to load book details')
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [bookId])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-8">
              <Skeleton className="w-[200px] h-[300px] rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (notFound || !book) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/dashboard">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Book Not Found</h2>
            <p className="text-muted-foreground">
              We couldn&apos;t find the book you&apos;re looking for.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const author = book.cached_contributors?.[0]?.author?.name || 'Unknown Author'
  const parsedImage = typeof book.cached_image === 'string'
    ? (() => { try { return JSON.parse(book.cached_image) } catch { return null } })()
    : book.cached_image
  const coverUrl = parsedImage?.url || null

  const progressPercent = readingProgress?.progress
    ? Math.min(Math.round(readingProgress.progress), 100)
    : readingProgress?.progress_pages && book.pages
      ? Math.min(Math.round((readingProgress.progress_pages / book.pages) * 100), 100)
      : null

  async function handleRating(newRating: number) {
    const prevRating = userRating
    setUserRating(newRating)
    try {
      const res = await fetch('/api/hardcover/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: Number(bookId), rating: newRating }),
      })
      if (res.ok) {
        toast.success(`Rated ${Number.isInteger(newRating) ? newRating : newRating.toFixed(1)}/5`)
      } else {
        setUserRating(prevRating)
        const data = await res.json()
        toast.error(data.error || 'Failed to update rating')
      }
    } catch {
      setUserRating(prevRating)
      toast.error('Failed to update rating')
    }
  }

  async function handleProgressSave() {
    const val = Number(progressInput)
    if (isNaN(val) || val < 0 || !progressInput) return
    setSavingProgress(true)
    try {
      const body: Record<string, unknown> = { bookId: Number(bookId) }
      if (progressMode === 'pages') {
        body.progressPages = val
      } else {
        body.progress = Math.min(val, 100)
      }
      const res = await fetch('/api/hardcover/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Progress updated!')
        // Update local state to reflect changes
        if (progressMode === 'pages') {
          setReadingProgress(prev => ({ progress: prev?.progress ?? null, progress_pages: val }))
        } else {
          setReadingProgress(prev => ({ progress: val, progress_pages: prev?.progress_pages ?? null }))
        }
        setEditingProgress(false)
        setProgressInput('')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update')
      }
    } catch {
      toast.error('Failed to update progress')
    } finally {
      setSavingProgress(false)
    }
  }

  const libbyUrl = `https://libbyapp.com/search/${encodeURIComponent(`title:${book.title} author:${author}`)}`
  const hardcoverUrl = book.slug ? `https://hardcover.app/books/${book.slug}` : null
  const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(`${book.title} ${author}`)}&i=stripbooks`

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard">
        <Button variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>

      <Card>
        <CardContent className="pt-6">
          {/* Top section: Cover + Info side by side */}
          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover */}
            <div className="flex-shrink-0">
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt={book.title}
                  width={200}
                  height={300}
                  className="rounded-lg shadow-md object-cover"
                />
              ) : (
                <div className="w-[200px] h-[300px] bg-muted rounded-lg flex items-center justify-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-2xl font-bold">{book.title}</h1>
                <p className="text-lg text-muted-foreground mt-1">by {author}</p>
              </div>

              {/* Rating + Action buttons — side by side */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Rating — clickable half-stars */}
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Your Rating</p>
                  <StarRating rating={userRating} onRate={handleRating} size="lg" />
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 sm:w-2/5 flex-shrink-0">
                  <a href={libbyUrl} target="_blank" rel="noopener noreferrer">
                    <Button
                      className="w-full justify-center gap-2 text-white hover:opacity-90 transition-shadow hover:shadow-lg"
                      style={{ backgroundColor: 'rgb(93, 33, 55)' }}
                    >
                      <LibbyIcon className="h-5 w-5" />
                      Search on Libby
                    </Button>
                  </a>
                  {hardcoverUrl && (
                    <a href={hardcoverUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full justify-center gap-2 transition-shadow hover:shadow-lg">
                        <ExternalLink className="h-4 w-4" />
                        View on Hardcover
                      </Button>
                    </a>
                  )}
                  <a href={amazonUrl} target="_blank" rel="noopener noreferrer">
                    <Button
                      className="w-full justify-center gap-2 text-black hover:opacity-90 transition-shadow hover:shadow-lg"
                      style={{ backgroundColor: 'rgb(244, 192, 118)' }}
                    >
                      <AmazonIcon className="h-5 w-5" />
                      View on Amazon
                    </Button>
                  </a>
                </div>
              </div>

              {/* Your Progress — editable, toggleable between % and pages */}
              <div className="space-y-2 sm:max-w-[60%]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    Your Progress
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      className={`text-[11px] px-2 py-0.5 rounded transition-colors ${progressMode === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                      onClick={() => setProgressMode('percent')}
                    >
                      %
                    </button>
                    <button
                      className={`text-[11px] px-2 py-0.5 rounded transition-colors ${progressMode === 'pages' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                      onClick={() => setProgressMode('pages')}
                    >
                      Pages
                    </button>
                  </div>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progressPercent ?? 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {progressMode === 'percent' ? (
                    <span>{progressPercent ?? 0}% complete</span>
                  ) : (
                    <span>
                      {readingProgress?.progress_pages
                        ? `Page ${readingProgress.progress_pages}${book.pages ? ` of ${book.pages}` : ''}`
                        : `0${book.pages ? ` of ${book.pages}` : ''} pages`}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant={editingProgress ? 'outline' : 'default'}
                    onClick={() => {
                      setEditingProgress(!editingProgress)
                      setProgressInput('')
                    }}
                    className="h-6 text-[11px] px-3"
                  >
                    {editingProgress ? 'Cancel' : 'Update'}
                  </Button>
                </div>
                {editingProgress && (
                  <div className="flex items-end gap-2 pt-1">
                    <div className="flex-1">
                      <Label className="text-[11px]">
                        {progressMode === 'pages'
                          ? `Page${book.pages ? ` (of ${book.pages})` : ''}`
                          : '% complete'}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={progressMode === 'percent' ? 100 : book.pages || 9999}
                        placeholder={progressMode === 'pages' ? 'e.g. 150' : 'e.g. 45'}
                        value={progressInput}
                        onChange={e => setProgressInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleProgressSave()}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <Button
                      onClick={handleProgressSave}
                      size="sm"
                      className="h-8 text-xs"
                      disabled={savingProgress}
                    >
                      {savingProgress ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                {book.pages && <Badge variant="secondary">{book.pages} pages</Badge>}
                {book.release_date && (
                  <Badge variant="secondary">
                    Released: {new Date(book.release_date).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Description — full width below the cover/info row */}
          {book.description && (
            <div className="mt-6 pt-6 border-t">
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {book.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      {bookActivity.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Recent Activity
            </h2>
            <div className="space-y-3">
              {bookActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <div className="flex-1">
                    <p>
                      {item.type === 'progress' && `Updated progress to ${item.value}`}
                      {item.type === 'pages' && `Read to ${item.value}`}
                      {item.type === 'rating' && `Rated ${item.value}`}
                    </p>
                    {item.date && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(item.date).toLocaleDateString()}
                      </p>
                    )}
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
