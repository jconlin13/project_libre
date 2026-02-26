'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, BookOpen, CheckCircle, BookMarked, Bookmark, Ban, ChevronDown, ThumbsUp } from 'lucide-react'
import { AmazonIcon } from '@/components/icons/amazon-icon'
import { LibbyIcon } from '@/components/icons/libby-icon'
import { HardcoverIcon } from '@/components/icons/hardcover-icon'
import { StarRating } from '@/components/star-rating'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { RecommendDialog } from '@/components/recommend-dialog'

interface BookDetailContentProps {
  bookId: string
  userName: string
  userId: string
}

const STATUS_CONFIG: Record<number, {
  label: string
  icon: React.ElementType
  textColor: string
  bgColor: string
  borderColor: string
}> = {
  1: { label: 'Want to Read', icon: Bookmark, textColor: '#a16207', bgColor: '#fef9c3', borderColor: '#fde047' },
  2: { label: 'Currently Reading', icon: BookMarked, textColor: '#1d4ed8', bgColor: '#dbeafe', borderColor: '#93c5fd' },
  3: { label: 'Read', icon: CheckCircle, textColor: '#15803d', bgColor: '#dcfce7', borderColor: '#86efac' },
  5: { label: 'Did Not Finish', icon: Ban, textColor: '#b91c1c', bgColor: '#fee2e2', borderColor: '#fca5a5' },
}

export default function BookDetailContent({ bookId, userName, userId }: BookDetailContentProps) {
  const [book, setBook] = useState<any>(null)
  const [readingProgress, setReadingProgress] = useState<{ progress: number | null; progress_pages: number | null } | null>(null)
  const [userRating, setUserRating] = useState<number>(0)
  const [bookStatus, setBookStatus] = useState<number | null>(null)
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false)
  const [bookActivity, setBookActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // User book identity for fast-path API calls (avoids 3-fetch pattern)
  const [userBookIdState, setUserBookIdState] = useState<number | null>(null)
  const [readIdState, setReadIdState] = useState<number | null>(null)

  // Recommend dialog state
  const [recommendDialogOpen, setRecommendDialogOpen] = useState(false)
  const [hasRecommended, setHasRecommended] = useState(false)

  // Progress tracker state
  const [progressMode, setProgressMode] = useState<'percent' | 'pages'>('percent')
  const [editingProgress, setEditingProgress] = useState(false)
  const [progressInput, setProgressInput] = useState('')
  const [savingProgress, setSavingProgress] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [bookRes, readingRes, finishedRes, wantToReadRes] = await Promise.all([
          fetch(`/api/hardcover?action=book&bookId=${bookId}`),
          fetch('/api/hardcover?action=reading'),
          fetch('/api/hardcover?action=finished&limit=50'),
          fetch('/api/hardcover?action=want-to-read'),
        ])

        const bookJson = await bookRes.json()
        const bookData = bookJson.data

        if (!bookData) {
          setNotFound(true)
          return
        }

        setBook(bookData)

        // Parse all lists once
        const readingBooks = readingRes.ok ? (await readingRes.json()).data || [] : []
        const finishedBooks = finishedRes.ok ? (await finishedRes.json()).data || [] : []
        const wantToReadBooks = wantToReadRes.ok ? (await wantToReadRes.json()).data || [] : []

        // Find the user_book entry across all lists
        const allUserBooks = [...readingBooks, ...finishedBooks, ...wantToReadBooks]
        const userBookMatch = allUserBooks.find((ub: any) => String(ub.book.id) === bookId)

        if (userBookMatch) {
          // Store user_book ID for fast-path API calls
          setUserBookIdState(userBookMatch.id)
          const firstRead = userBookMatch.user_book_reads?.[0]
          if (firstRead?.id) setReadIdState(firstRead.id)

          // Set status
          if (userBookMatch.status_id) {
            setBookStatus(userBookMatch.status_id)
          }

          // Set rating
          if (userBookMatch.rating) {
            setUserRating(userBookMatch.rating)
          }

          // Set progress from reading match
          const readingMatch = readingBooks.find((ub: any) => String(ub.book.id) === bookId)
          if (readingMatch) {
            const read = readingMatch.user_book_reads?.[0]
            if (read) {
              setReadingProgress({ progress: read.progress, progress_pages: read.progress_pages })
            }
          }

          // Build activity timeline
          const activityItems: any[] = []
          const reads = userBookMatch.user_book_reads || []
          reads.forEach((read: any) => {
            if (read.progress != null && read.progress > 0) {
              activityItems.push({
                type: 'progress',
                value: `${Math.round(read.progress)}%`,
                date: read.started_at,
                user: userName,
              })
            }
            if (read.progress_pages != null && read.progress_pages > 0) {
              activityItems.push({
                type: 'pages',
                value: `page ${read.progress_pages}`,
                date: read.started_at,
                user: userName,
              })
            }
          })
          if (userBookMatch.rating) {
            activityItems.push({
              type: 'rating',
              value: `${userBookMatch.rating}/5 stars`,
              date: userBookMatch.date_added || userBookMatch.last_read_date,
              user: userName,
            })
          }
          // Add status as activity
          if (userBookMatch.status_id && STATUS_CONFIG[userBookMatch.status_id]) {
            activityItems.push({
              type: 'status',
              value: STATUS_CONFIG[userBookMatch.status_id].label,
              date: userBookMatch.date_added,
              user: userName,
            })
          }
          setBookActivity(activityItems)
        }
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
  const authorSlug = book.cached_contributors?.[0]?.author?.slug || null
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
        body: JSON.stringify({ bookId: Number(bookId), rating: newRating, userBookId: userBookIdState, bookTitle: book.title, bookAuthor: author, bookCoverUrl: coverUrl }),
      })
      if (res.ok) {
        toast.success(newRating === 0 ? 'Rating cleared' : `Rated ${Number.isInteger(newRating) ? newRating : newRating.toFixed(1)}/5`)
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

  async function handleStatusChange(newStatusId: number) {
    const prevStatus = bookStatus
    setBookStatus(newStatusId)
    setStatusPopoverOpen(false)
    try {
      const res = await fetch('/api/hardcover/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: Number(bookId), statusId: newStatusId, userBookId: userBookIdState, bookTitle: book.title, bookAuthor: author, bookCoverUrl: coverUrl }),
      })
      if (res.ok) {
        const config = STATUS_CONFIG[newStatusId]
        toast.success(`Marked as "${config?.label}"`)
      } else {
        setBookStatus(prevStatus)
        const data = await res.json()
        toast.error(data.error || 'Failed to update status')
      }
    } catch {
      setBookStatus(prevStatus)
      toast.error('Failed to update status')
    }
  }

  async function handleProgressSave() {
    const val = Number(progressInput)
    if (isNaN(val) || val < 0 || !progressInput) return
    setSavingProgress(true)
    try {
      const body: Record<string, unknown> = { bookId: Number(bookId), userBookId: userBookIdState, readId: readIdState, bookTitle: book.title, bookAuthor: author, bookCoverUrl: coverUrl }
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

  const currentStatusConfig = bookStatus ? STATUS_CONFIG[bookStatus] : null

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
            {/* Cover + Metadata */}
            <div className="flex-shrink-0 flex flex-col items-center self-start">
              {coverUrl ? (
                <div className="relative w-[200px] rounded-lg shadow-md overflow-hidden" style={{ aspectRatio: '2/3' }}>
                  <Image
                    src={coverUrl}
                    alt={book.title}
                    fill
                    className="object-cover object-top"
                    sizes="200px"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-[200px] bg-muted rounded-lg flex items-center justify-center" style={{ aspectRatio: '2/3' }}>
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              {/* Metadata badges centered under cover, single line */}
              <div className="flex justify-center gap-2 mt-3">
                {book.pages && <Badge variant="secondary" className="text-[11px]">{book.pages} pages</Badge>}
                {book.release_date && (
                  <Badge variant="secondary" className="text-[11px]">
                    Released: {new Date(book.release_date).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              {/* Title + Author — full width */}
              <div>
                <h1 className="text-2xl font-bold">{book.title}</h1>
                <p className="text-lg text-muted-foreground mt-1">
                  by{' '}
                  {authorSlug ? (
                    <a
                      href={`https://hardcover.app/authors/${authorSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline hover:text-foreground transition-colors"
                    >
                      {author}
                    </a>
                  ) : (
                    author
                  )}
                </p>
              </div>

              {/* Status/Rating/Progress + Action buttons side by side */}
              <div className="flex flex-col sm:flex-row gap-4">
              {/* Left column: status, rating, progress */}
              <div className="flex-1 space-y-4">

              {/* Status badge with popover to change */}
              {bookStatus && currentStatusConfig ? (
                <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 cursor-pointer group">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border"
                        style={{
                          color: currentStatusConfig.textColor,
                          backgroundColor: currentStatusConfig.bgColor,
                          borderColor: currentStatusConfig.borderColor,
                        }}
                      >
                        <currentStatusConfig.icon className="h-4 w-4" />
                        {currentStatusConfig.label}
                        <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-1.5" align="start">
                    <div className="space-y-0.5">
                      {Object.entries(STATUS_CONFIG).map(([id, config]) => {
                        const statusId = Number(id)
                        const isActive = statusId === bookStatus
                        const StatusIcon = config.icon
                        return (
                          <button
                            key={id}
                            onClick={() => handleStatusChange(statusId)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-muted cursor-pointer"
                            style={isActive ? {
                              color: config.textColor,
                              backgroundColor: config.bgColor,
                              fontWeight: 500,
                            } : undefined}
                          >
                            <StatusIcon
                              className="h-4 w-4 flex-shrink-0"
                              style={{ color: config.textColor }}
                            />
                            {config.label}
                          </button>
                        )
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : bookStatus === null && !loading ? (
                <p className="text-sm text-muted-foreground italic">Not in your library</p>
              ) : null}

              {/* Recommend button */}
              {bookStatus !== null && (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-sm cursor-pointer"
                    style={{ maxWidth: '90%' }}
                    onClick={() => setRecommendDialogOpen(true)}
                    disabled={hasRecommended}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    {hasRecommended ? 'Recommended \u2713' : 'Recommend'}
                  </Button>
                  <RecommendDialog
                    open={recommendDialogOpen}
                    onOpenChange={setRecommendDialogOpen}
                    userId={userId}
                    bookId={bookId}
                    bookTitle={book.title}
                    bookAuthor={author}
                    bookCoverUrl={coverUrl}
                    onSuccess={() => setHasRecommended(true)}
                  />
                </div>
              )}

              {/* Rating + Progress */}
              <div>
                  <p className="text-sm text-muted-foreground mb-1">Your Rating</p>
                  <StarRating rating={userRating} onRate={handleRating} size="lg" />
                  {userRating > 0 && (
                    <button
                      onClick={() => handleRating(0)}
                      className="text-[11px] text-muted-foreground hover:text-foreground mt-1 block cursor-pointer"
                    >
                      Clear rating
                    </button>
                  )}

                  {/* Your Progress — below rating */}
                  <div className="space-y-2 mt-4" style={{ maxWidth: '75%' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        Your Progress
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          className={`text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer ${progressMode === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                          onClick={() => setProgressMode('percent')}
                        >
                          %
                        </button>
                        <button
                          className={`text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer ${progressMode === 'pages' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
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
                        className="h-6 text-[11px] px-3 cursor-pointer"
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
                          className="h-8 text-xs cursor-pointer"
                          disabled={savingProgress}
                        >
                          {savingProgress ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
              {/* End left column */}

              {/* Action buttons — right column */}
              <div className="flex flex-col gap-2 sm:w-2/5 flex-shrink-0">
                <a href={libbyUrl} target="_blank" rel="noopener noreferrer">
                  <Button
                    className="w-full justify-center gap-2 text-white transition-shadow hover:shadow-lg cursor-pointer"
                    style={{ backgroundColor: 'rgb(93, 33, 55)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgb(73, 23, 42)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgb(93, 33, 55)')}
                  >
                    <LibbyIcon className="h-5 w-5" />
                    Search on Libby
                  </Button>
                </a>
                {hardcoverUrl && (
                  <a href={hardcoverUrl} target="_blank" rel="noopener noreferrer">
                    <Button
                      className="w-full justify-center gap-2 text-white transition-shadow hover:shadow-lg cursor-pointer"
                      style={{ backgroundColor: 'rgb(49, 46, 124)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgb(35, 33, 98)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgb(49, 46, 124)')}
                    >
                      <HardcoverIcon className="h-5 w-5" />
                      View on Hardcover
                    </Button>
                  </a>
                )}
                <a href={amazonUrl} target="_blank" rel="noopener noreferrer">
                  <Button
                    className="w-full justify-center gap-2 text-black transition-shadow hover:shadow-lg cursor-pointer"
                    style={{ backgroundColor: 'rgb(244, 192, 118)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgb(224, 170, 90)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgb(244, 192, 118)')}
                  >
                    <AmazonIcon className="h-5 w-5" />
                    View on Amazon
                  </Button>
                </a>
              </div>
              </div>
              {/* End flex row */}
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
                      <span className="font-bold">{item.user}</span>
                      {item.type === 'progress' && ` updated progress to ${item.value}`}
                      {item.type === 'pages' && ` read to ${item.value}`}
                      {item.type === 'rating' && ` rated ${item.value}`}
                      {item.type === 'status' && ` shelved as ${item.value}`}
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
