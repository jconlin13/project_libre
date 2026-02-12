'use client'

import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Library, Star, ExternalLink, ChevronRight } from 'lucide-react'
import { getLibbySearchUrl, getHardcoverBookUrl } from '@/lib/hardcover'

interface BookCardProps {
  book: {
    id: number
    title: string
    slug?: string
    cached_image?: { url: string } | null
    cached_contributors?: { author: { name: string } }[]
    pages?: number
  }
  rating?: number | null
  status?: string
  progress?: number | null
  progressPages?: number | null
  showActions?: boolean
  onRecommend?: () => void
  onPlusOne?: () => void
  onUpdateProgress?: () => void
  compact?: boolean
  cover?: boolean
}

export function BookCard({ book, rating, status, progress, progressPages, showActions, onRecommend, onPlusOne, onUpdateProgress, compact, cover }: BookCardProps) {
  const author = book.cached_contributors?.[0]?.author?.name || 'Unknown Author'
  const coverUrl = book.cached_image?.url || null

  const libbyUrl = getLibbySearchUrl(book.title, author)
  const hardcoverUrl = book.slug ? getHardcoverBookUrl(book.slug) : null

  // Cover mode: vertical book cover with title + author centered below
  if (cover) {
    const progressPercent = progress != null && progress > 0
      ? Math.round(Math.min(progress, 100))
      : progressPages != null && progressPages > 0 && book.pages
        ? Math.round(Math.min((progressPages / book.pages) * 100, 100))
        : null

    return (
      <div className="flex flex-col items-center w-[120px] flex-shrink-0 group">
        {/* Cover image */}
        <div className="relative w-[120px] h-[180px] overflow-hidden rounded-lg shadow-md transition-shadow group-hover:shadow-lg">
          {coverUrl ? (
            <Image src={coverUrl} alt={book.title} fill className="object-cover" sizes="120px" />
          ) : (
            <div className="h-full w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
              No cover
            </div>
          )}
          {/* Progress overlay at bottom of cover */}
          {progressPercent !== null && (
            <div className="absolute bottom-0 left-0 right-0">
              <div className="h-1.5 bg-black/30">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Title (italic, centered) */}
        <p className="mt-2 text-xs font-medium italic text-center leading-tight line-clamp-2 w-full">
          {book.title}
        </p>

        {/* Author (centered) */}
        <p className="mt-0.5 text-[11px] text-muted-foreground text-center leading-tight line-clamp-1 w-full">
          {author}
        </p>

        {/* Rating stars */}
        {rating != null && rating > 0 && (
          <div className="flex items-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                className={`h-3 w-3 ${star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/30'}`}
              />
            ))}
          </div>
        )}

        {/* Progress text */}
        {progressPercent !== null && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{progressPercent}%</p>
        )}

        {/* Update Progress button */}
        {onUpdateProgress && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpdateProgress() }}
            className="mt-1.5 flex items-center gap-0.5 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
          >
            Update Progress
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

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
          {rating != null && rating > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  className={`h-3 w-3 ${star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/30'}`}
                />
              ))}
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
          {rating != null && rating > 0 && (
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  className={`h-3.5 w-3.5 ${star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/30'}`}
                />
              ))}
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
