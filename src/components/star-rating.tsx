'use client'

import { useState, useRef } from 'react'
import { Star, StarHalf } from 'lucide-react'

interface StarRatingProps {
  rating: number // 0-5 in 0.5 increments
  onRate?: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
  readOnly?: boolean
}

const sizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

/**
 * StarRating component supporting half-star ratings.
 * Click on the left half of a star for X.5, right half for X.0.
 * Hover previews the value before clicking.
 */
export function StarRating({ rating, onRate, size = 'md', readOnly = false }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const sizeClass = sizes[size]
  const displayValue = hoverValue > 0 ? hoverValue : rating

  function getStarValue(starIndex: number, e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const isLeftHalf = x < rect.width / 2
    return isLeftHalf ? starIndex - 0.5 : starIndex
  }

  return (
    <div
      ref={containerRef}
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => !readOnly && setHoverValue(0)}
    >
      {[1, 2, 3, 4, 5].map(star => {
        // Determine fill state for this star
        const full = displayValue >= star
        const half = !full && displayValue >= star - 0.5

        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            className={`p-0 ${readOnly ? 'cursor-default' : 'cursor-pointer'} relative`}
            onClick={(e) => {
              if (readOnly || !onRate) return
              e.preventDefault()
              e.stopPropagation()
              const val = getStarValue(star, e)
              onRate(val)
            }}
            onMouseMove={(e) => {
              if (readOnly) return
              const val = getStarValue(star, e)
              setHoverValue(val)
            }}
            onMouseEnter={(e) => {
              if (readOnly) return
              const val = getStarValue(star, e)
              setHoverValue(val)
            }}
          >
            {full ? (
              <Star className={`${sizeClass} fill-yellow-500 text-yellow-500`} />
            ) : half ? (
              <span className="relative inline-flex">
                <Star className={`${sizeClass} text-muted-foreground/30`} />
                <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                  <Star className={`${sizeClass} fill-yellow-500 text-yellow-500`} />
                </span>
              </span>
            ) : (
              <Star className={`${sizeClass} text-muted-foreground/30`} />
            )}
          </button>
        )
      })}
      {rating > 0 && (
        <span className={`ml-1 text-muted-foreground ${size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm'}`}>
          {Number.isInteger(rating) ? rating : rating.toFixed(1)}/5
        </span>
      )}
    </div>
  )
}
