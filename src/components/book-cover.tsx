'use client'

import { useState } from 'react'
import Image from 'next/image'

/**
 * Book cover with a legible fallback.
 *
 * Imported books often have no cover art — either the row had no ISBN, or Open
 * Library has no image for it. An empty grey box reads as a broken page, so we
 * fall back to a title card instead.
 */
export function BookCover({
  url,
  title,
  author,
  className = '',
  sizes = '150px',
}: {
  url: string | null
  title: string | null
  author?: string | null
  className?: string
  sizes?: string
}) {
  const [failed, setFailed] = useState(false)
  const showFallback = !url || failed

  return (
    <div className={`relative overflow-hidden rounded bg-muted ${className}`}>
      {showFallback ? (
        <div className="flex h-full w-full flex-col justify-center gap-1 bg-gradient-to-br from-muted to-muted/50 p-2 text-center">
          <p className="text-[10px] font-medium leading-tight line-clamp-4 text-foreground/80">
            {title || 'Untitled'}
          </p>
          {author && (
            <p className="text-[9px] leading-tight line-clamp-2 text-muted-foreground">{author}</p>
          )}
        </div>
      ) : (
        <Image
          src={url}
          alt={title || ''}
          fill
          className="object-cover"
          sizes={sizes}
          unoptimized
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
