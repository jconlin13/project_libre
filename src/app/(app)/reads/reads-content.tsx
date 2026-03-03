'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Newspaper } from 'lucide-react'
import { toast } from 'sonner'
import { ArticleCard, type ArticleData } from '@/components/article-card'
import { AddArticleDialog } from '@/components/add-article-dialog'
import { ArticleRecommendDialog } from '@/components/article-recommend-dialog'

type ViewMode = 'all' | 'saved' | 'mine'

interface ReadsContentProps {
  userId: string
}

export function ReadsContent({ userId }: ReadsContentProps) {
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [recommendArticleId, setRecommendArticleId] = useState<string | null>(null)
  const [recommendArticleTitle, setRecommendArticleTitle] = useState('')

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch('/api/articles')
      const { data } = await res.json()
      if (data) setArticles(data)
    } catch {
      toast.error('Failed to load articles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  // Derive available tags from all articles
  const allTags = [...new Set(articles.flatMap(a => a.tags))].sort()

  // Filter articles
  let filtered = articles
  if (viewMode === 'saved') {
    filtered = filtered.filter(a => a.isSaved)
  } else if (viewMode === 'mine') {
    filtered = filtered.filter(a => a.user.id === userId)
  }
  if (selectedTag) {
    filtered = filtered.filter(a => a.tags.includes(selectedTag))
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(
      a =>
        a.title.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.source?.toLowerCase().includes(q)
    )
  }

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
        toast.success(data.saved ? 'Saved!' : 'Unsaved')
      }
    } catch {
      toast.error('Failed to save')
    }
  }

  async function handleDelete(articleId: string) {
    try {
      const res = await fetch(`/api/articles?id=${articleId}`, { method: 'DELETE' })
      if (res.ok) {
        setArticles(prev => prev.filter(a => a.id !== articleId))
        toast.success('Article removed')
      }
    } catch {
      toast.error('Failed to delete')
    }
  }

  function handleRecommend(articleId: string) {
    const article = articles.find(a => a.id === articleId)
    if (article) {
      setRecommendArticleId(articleId)
      setRecommendArticleTitle(article.title)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Newspaper className="h-6 w-6" />
          Reads
        </h1>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="gap-1.5 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Article
        </Button>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(['all', 'saved', 'mine'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-sm rounded-md transition-colors cursor-pointer ${
                viewMode === mode
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode === 'all' ? 'All' : mode === 'saved' ? 'Saved' : 'Mine'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Tag filter pills */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {allTags.map(tag => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            >
              {tag}
            </Badge>
          ))}
          {selectedTag && (
            <button
              onClick={() => setSelectedTag(null)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer ml-1"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Article list */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              currentUserId={userId}
              onSave={handleSave}
              onDelete={handleDelete}
              onRecommend={handleRecommend}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Newspaper className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {articles.length === 0
                ? 'No articles shared yet. Be the first!'
                : 'No articles match your filters.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <AddArticleDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={fetchArticles}
      />

      {recommendArticleId && (
        <ArticleRecommendDialog
          open={!!recommendArticleId}
          onOpenChange={(v) => { if (!v) setRecommendArticleId(null) }}
          userId={userId}
          articleId={recommendArticleId}
          articleTitle={recommendArticleTitle}
          onSuccess={fetchArticles}
        />
      )}
    </div>
  )
}
