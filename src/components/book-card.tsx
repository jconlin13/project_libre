'use client'

import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Library, Star, ExternalLink } from 'lucide-react'
import { getLibbySearchUrl, getHardcoverBookUrl } from '@/lib/hardcover'

interface BookCardProps {
  book: {
    id: number
    title: string
    slug?: string
    cached_image?: string
    cached_contributors?: { author: { name: string } }[]
    isbn_13?: string
    isbn_10?: string
    pages?: number
  }
  rating?: number | null
  status?: string
  progress?: number | null
  progressPages?: number | null
  showActions?: boolean
  onRecommend?: () => void
  onPlusOne?: () => void
  compact?: boolean
}

export function BookCard({ book, rating, status, progress, progressPages, showActions, onRecommend, onPlusOne, compact }: BookCardProps) {
  const author = book.cached_contributors?.[0]?.author?.name || 'Unknown Author'
  const coverUrl = book.cached_image ||
    (book.isbn_13 ? `https://covers.openlibrary.org/b/isbn/${book.isbn_13}-L.jpg` : null) ||
    (book.isbn_10 ? `https://covers.openlibrary.org/b/isbn/${book.isbn_10}-L.jpg` : null)

  const libbyUrl = getLibbySearchUrl(book.title, author)
  const hardcoverUrl = book.slug ? getHardcoverBookUrl(book.slug) : null

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors">
        <div className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded">
          {coverUrl ? (
            <Image src={coverUrl} alt={book.title} fill className="object-cover" sizes="44px" />
          ) : (
            <div className="h-full w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
              No cover
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{book.title}</p>
          <p className="truncate text-xs text-muted-foreground">{author}</p>
          {rating && (
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              <span className="text-xs">{rating}/5</span>
            </div>
          )}
          {progress != null && progress > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {Math.round(progress)}%
              </span>
            </div>
          )}
          {(progress == null || progress === 0) && progressPages != null && progressPages > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${book.pages ? Math.min((progressPages / book.pages) * 100, 100) : 0}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {progressPages}{book.pages ? `/${book.pages}p` : 'p'}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex gap-4 p-4">
        <div className="relative h-32 w-20 flex-shrink-0 overflow-hidden rounded-md">
          {coverUrl ? (
            <Image src={coverUrl} alt={book.title} fill className="object-cover" sizes="80px" />
          ) : (
            <div className="h-full w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
              No cover
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <h3 className="font-semibold truncate">{book.title}</h3>
          <p className="text-sm text-muted-foreground">{author}</p>
          {rating && (
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  className={`h-3.5 w-3.5 ${star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/30'}`}
                />
              ))}
              <span className="ml-1 text-xs text-muted-foreground">{rating}</span>
            </div>
          )}
          {status && (
            <Badge variant="secondary" className="mt-2 w-fit text-xs">
              {status === '2' ? 'Reading' : status === '3' ? 'Finished' : status === '1' ? 'Want to Read' : status}
            </Badge>
          )}
          {progress != null && progress > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {Math.round(progress)}%
              </span>
            </div>
          )}
          {(progress == null || progress === 0) && progressPages != null && progressPages > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${book.pages ? Math.min((progressPages / book.pages) * 100, 100) : 0}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {progressPages}{book.pages ? `/${book.pages}p` : 'p'}
              </span>
            </div>
          )}
          <div className="mt-auto flex items-center gap-2 pt-2">
            <a href={libbyUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                <Library className="h-3 w-3" />
                Libby
              </Button>
            </a>
            {hardcoverUrl && (
              <a href={hardcoverUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                  <ExternalLink className="h-3 w-3" />
                  Hardcover
                </Button>
              </a>
            )}
            {showActions && onRecommend && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRecommend}>
                Recommend
              </Button>
            )}
            {showActions && onPlusOne && (
              <Button variant="default" size="sm" className="h-7 text-xs" onClick={onPlusOne}>
                +1
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
