'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Star, Library, ExternalLink, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface BookDetailContentProps {
  bookId: string
}

export default function BookDetailContent({ bookId }: BookDetailContentProps) {
  const [book, setBook] = useState<any>(null)
  const [readingProgress, setReadingProgress] = useState<{ progress: number | null; progress_pages: number | null } | null>(null)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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

        // Check if currently reading this book
        if (readingRes.ok) {
          const readingJson = await readingRes.json()
          const readingBooks = readingJson.data || []
          const match = readingBooks.find((ub: any) => String(ub.book.id) === bookId)
          if (match) {
            const read = match.user_book_reads?.[0]
            if (read) {
              setReadingProgress({ progress: read.progress, progress_pages: read.progress_pages })
            }
          }
        }

        // Check if user rated this book
        if (finishedRes.ok) {
          const finishedJson = await finishedRes.json()
          const finishedBooks = finishedJson.data || []
          const match = finishedBooks.find((ub: any) => String(ub.book.id) === bookId)
          if (match?.rating) {
            setUserRating(match.rating)
          }
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
  const coverUrl = book.cached_image?.url || null

  const progressPercent = readingProgress?.progress
    ? Math.min(Math.round(readingProgress.progress), 100)
    : readingProgress?.progress_pages && book.pages
      ? Math.min(Math.round((readingProgress.progress_pages / book.pages) * 100), 100)
      : null

  const libbyUrl = `https://libbyapp.com/search/${encodeURIComponent(`title:${book.title} author:${author}`)}`
  const hardcoverUrl = book.slug ? `https://hardcover.app/books/${book.slug}` : null

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

              {/* Rating */}
              {userRating && (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${star <= userRating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/30'}`}
                    />
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">
                    Your rating: {userRating}/5
                  </span>
                </div>
              )}

              {/* Progress */}
              {progressPercent !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      Reading Progress
                    </span>
                    <span className="text-muted-foreground">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {readingProgress?.progress_pages && (
                    <p className="text-xs text-muted-foreground">
                      Page {readingProgress.progress_pages}{book.pages ? ` of ${book.pages}` : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                {book.pages && <Badge variant="secondary">{book.pages} pages</Badge>}
                {book.release_date && (
                  <Badge variant="secondary">
                    Released: {new Date(book.release_date).toLocaleDateString()}
                  </Badge>
                )}
              </div>

              {/* Description */}
              {book.description && (
                <div>
                  <h2 className="font-semibold mb-2">Description</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {book.description}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-4">
                <a href={libbyUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">
                    <Library className="mr-2 h-4 w-4" />
                    Search on Libby
                  </Button>
                </a>
                {hardcoverUrl && (
                  <a href={hardcoverUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View on Hardcover
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
