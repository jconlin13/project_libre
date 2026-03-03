'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Newspaper, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { ArticleCard, type ArticleData } from '@/components/article-card'
import { toast } from 'sonner'

interface ReadsModuleProps {
  userId: string
}

export function ReadsModule({ userId }: ReadsModuleProps) {
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/articles?limit=5')
      .then(r => r.json())
      .then(d => {
        if (d.data) setArticles(d.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(articleId: string) {
    try {
      const res = await fetch('/api/articles/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      })
      const { data } = await res.json()
      if (data) {
        setArticles(prev =>
          prev.map(a =>
            a.id === articleId ? { ...a, isSaved: data.saved } : a
          )
        )
      }
    } catch {
      toast.error('Failed to save')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Newspaper className="h-4 w-4" />
            Recent Reads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-4">
            No articles shared yet.
          </p>
          <Link
            href="/reads"
            className="text-xs text-primary hover:underline flex items-center justify-center gap-0.5"
          >
            Share an article <ChevronRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    )
  }

  // Show recommendations first, then recent articles
  const recommended = articles.filter(a => a.isRecommendedToMe)
  const others = articles.filter(a => !a.isRecommendedToMe)
  const sorted = [...recommended, ...others]

  return (
    <Card>
      <CardHeader className="pb-3">
        <Link
          href="/reads"
          className="flex items-center justify-between group"
        >
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Newspaper className="h-4 w-4" />
            Recent Reads
            {recommended.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {recommended.length}
              </span>
            )}
          </CardTitle>
          <span className="text-xs text-muted-foreground group-hover:text-foreground flex items-center gap-0.5 transition-colors">
            See all <ChevronRight className="h-3 w-3" />
          </span>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {sorted.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              currentUserId={userId}
              compact
              onSave={handleSave}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
