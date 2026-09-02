'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Activity } from 'lucide-react'

export interface ActivityItem {
  id: string
  type: string
  user?: { id: string; name: string; avatarUrl: string | null } | null
  targetUser?: { id: string; name: string } | null
  bookTitle?: string | null
  value?: string | null
  note?: string | null
  mediaType?: string | null
  createdAt: string
}

/** The sentence fragment that follows the actor's name in a feed row. */
export function renderActivityMessage(item: ActivityItem) {
  const isAudio = item.mediaType === 'audiobook'
  const title = <span className="font-medium">{item.bookTitle}</span>
  switch (item.type) {
    case 'status_change': {
      if (item.value === 'Read') {
        return <> finished {isAudio ? 'listening to' : 'reading'} {title}</>
      }
      if (item.value === 'Currently Reading') {
        return <> started {isAudio ? 'listening to' : 'reading'} {title}</>
      }
      return <> shelved {title} as {item.value}</>
    }
    case 'rating':
      return <> rated {title} {item.value === 'cleared' ? '(cleared rating)' : `${item.value}/5 stars`}</>
    case 'progress_update':
      return <> updated {title} to {item.value}</>
    case 'recommendation':
      return <> recommended {title} to <span className="font-medium">{item.targetUser?.name}</span></>
    case 'plus_one':
      return <> added {title} to their wishlist</>
    case 'article_shared':
      return <> shared an article: {title}</>
    case 'article_recommended':
      return <> recommended {title} to <span className="font-medium">{item.targetUser?.name}</span></>
    default:
      return <> did something with {title}</>
  }
}

export function ActivityFeedCard({
  items,
  title = 'Recent Activity',
  emptyMessage = 'No activity yet.',
  limit,
  showNotes = false,
}: {
  items: ActivityItem[]
  title?: string
  emptyMessage?: string
  limit?: number
  showNotes?: boolean
}) {
  const shown = limit ? items.slice(0, limit) : items

  if (shown.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {shown.map(item => (
            <div key={item.id} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
              <Avatar className="h-8 w-8 mt-0.5">
                <AvatarImage src={item.user?.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {item.user?.name?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{item.user?.name}</span>
                  {renderActivityMessage(item)}
                </p>
                {showNotes && item.note && (
                  <p className="text-xs text-muted-foreground mt-0.5 italic">
                    &ldquo;{item.note}&rdquo;
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
