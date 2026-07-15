'use client'

import { ExternalLink, Bookmark, BookmarkCheck, ThumbsUp, Trash2, Newspaper } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

/**
 * Get a favicon URL for a source domain using Google's S2 Favicon service.
 * Returns null if no URL is available.
 */
function getSourceFaviconUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return null
  }
}

export interface ArticleData {
  id: string
  url: string | null
  title: string
  description: string | null
  source: string | null
  imageUrl: string | null
  tags: string[]
  note: string | null
  createdAt: string
  user: { id: string; name: string; avatarUrl: string | null }
  isSaved: boolean
  isRecommendedToMe: boolean
  recommendationNote: string | null
  recommendedBy: { name: string; avatarUrl: string | null } | null
}

interface ArticleCardProps {
  article: ArticleData
  currentUserId: string
  compact?: boolean
  onSave?: (articleId: string) => void
  onDelete?: (articleId: string) => void
  onRecommend?: (articleId: string) => void
}

export function ArticleCard({
  article,
  currentUserId,
  compact = false,
  onSave,
  onDelete,
  onRecommend,
}: ArticleCardProps) {
  const isOwner = article.user.id === currentUserId
  const timeAgo = getTimeAgo(article.createdAt)

  const faviconUrl = getSourceFaviconUrl(article.url)

  // Compact mode for dashboard sidebar
  if (compact) {
    return (
      <div className="flex items-start gap-3 py-2">
        {/* Source favicon */}
        <div className="flex-shrink-0 mt-0.5">
          {faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faviconUrl} alt="" width={16} height={16} className="rounded-sm" />
          ) : (
            <Newspaper className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {article.url ? (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline line-clamp-2"
            >
              {article.title}
            </a>
          ) : (
            <p className="text-sm font-medium line-clamp-2">{article.title}</p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            {article.source && (
              <span className="text-xs text-muted-foreground">{article.source}</span>
            )}
            {article.source && <span className="text-muted-foreground/30">·</span>}
            <span className="text-xs text-muted-foreground">{article.user.name.split(' ')[0]}</span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
        </div>
      </div>
    )
  }

  // Full mode for /reads page
  return (
    <div
      className={`flex gap-4 p-4 rounded-lg border transition-colors ${
        article.isRecommendedToMe
          ? 'border-primary/30 bg-primary/5'
          : 'border-border hover:bg-muted/30'
      }`}
    >
      {/* Image thumbnail */}
      {article.imageUrl && (
        <div className="relative w-24 h-16 flex-shrink-0 rounded overflow-hidden">
          <Image
            src={article.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="96px"
            unoptimized
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Recommended badge */}
        {article.isRecommendedToMe && article.recommendedBy && (
          <div className="flex items-center gap-1.5 mb-1">
            <Badge variant="outline" className="text-[10px] h-5 gap-1 border-primary/30 text-primary">
              <ThumbsUp className="h-2.5 w-2.5" />
              Recommended by {article.recommendedBy.name.split(' ')[0]}
            </Badge>
          </div>
        )}

        {/* Title */}
        {article.url ? (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold hover:underline line-clamp-2 inline-flex items-center gap-1"
          >
            {article.title}
            <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          </a>
        ) : (
          <p className="text-sm font-semibold line-clamp-2">{article.title}</p>
        )}

        {/* Description */}
        {article.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {article.description}
          </p>
        )}

        {/* Recommendation note */}
        {article.isRecommendedToMe && article.recommendationNote && (
          <p className="text-xs text-primary/80 mt-1 italic">
            &ldquo;{article.recommendationNote}&rdquo;
          </p>
        )}

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {article.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px] h-4 px-1.5">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Meta row: sharer + source + time + actions */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={article.user.avatarUrl || undefined} />
              <AvatarFallback className="text-[8px]">
                {article.user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{article.user.name.split(' ')[0]}</span>
            {article.source && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="flex items-center gap-1">
                  {faviconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={faviconUrl} alt="" width={14} height={14} className="rounded-sm" />
                  )}
                  <span className="text-xs text-muted-foreground">{article.source}</span>
                </span>
              </>
            )}
            <span className="text-muted-foreground/30">·</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {onSave && (
              <button
                onClick={(e) => { e.stopPropagation(); onSave(article.id) }}
                className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                title={article.isSaved ? 'Unsave' : 'Save'}
              >
                {article.isSaved ? (
                  <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}
            {onRecommend && !isOwner && (
              <button
                onClick={(e) => { e.stopPropagation(); onRecommend(article.id) }}
                className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                title="Recommend"
              >
                <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            {onDelete && isOwner && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(article.id) }}
                className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
