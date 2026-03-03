'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Link as LinkIcon, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface AddArticleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface Preview {
  title: string | null
  description: string | null
  imageUrl: string | null
  source: string | null
}

export function AddArticleDialog({ open, onOpenChange, onSuccess }: AddArticleDialogProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [previewed, setPreviewed] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() {
    setUrl('')
    setTitle('')
    setDescription('')
    setSource('')
    setNote('')
    setImageUrl('')
    setPreviewing(false)
    setPreviewed(false)
    setManualMode(false)
    setSaving(false)
  }

  async function handlePreview() {
    if (!url.trim()) return
    setPreviewing(true)
    try {
      const res = await fetch(`/api/articles/preview?url=${encodeURIComponent(url.trim())}`)
      const { data } = await res.json()
      if (data) {
        setTitle(data.title || '')
        setDescription(data.description || '')
        setSource(data.source || '')
        setImageUrl(data.imageUrl || '')
        setPreviewed(true)
      }
    } catch {
      toast.error('Could not fetch link preview')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleSave() {
    if (!title.trim() && !url.trim()) {
      toast.error('A title or URL is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim() || null,
          title: title.trim() || null,
          description: description.trim() || null,
          source: source.trim() || null,
          imageUrl: imageUrl.trim() || null,
          note: note.trim() || null,
        }),
      })
      if (res.ok) {
        toast.success('Article shared!')
        reset()
        onOpenChange(false)
        onSuccess?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to share article')
      }
    } catch {
      toast.error('Failed to share article')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share an Article</DialogTitle>
          <DialogDescription>
            Paste a link or add manually. Your household will see it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {!manualMode ? (
            <>
              {/* URL input */}
              <div className="space-y-1.5">
                <Label className="text-xs">Link</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="https://..."
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      onBlur={() => url.trim() && !previewed && handlePreview()}
                      onKeyDown={e => e.key === 'Enter' && handlePreview()}
                      className="pl-8 text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={!url.trim() || previewing}
                    className="cursor-pointer"
                  >
                    {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Preview'}
                  </Button>
                </div>
              </div>

              {/* Preview card */}
              {previewed && (
                <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                  {imageUrl && (
                    <div className="relative w-full h-32 rounded overflow-hidden">
                      <Image src={imageUrl} alt="" fill className="object-cover" sizes="400px" unoptimized />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description (optional)</Label>
                    <Textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Source</Label>
                    <Input
                      value={source}
                      onChange={e => setSource(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Manual mode toggle */}
              <button
                onClick={() => setManualMode(true)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Or add without a URL
              </button>
            </>
          ) : (
            <>
              {/* Manual entry fields */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title *</Label>
                  <Input
                    placeholder="Article title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Source (optional)</Label>
                  <Input
                    placeholder="e.g. NYT, The Atlantic, Substack"
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description (optional)</Label>
                  <Textarea
                    placeholder="Brief description..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Back to URL mode */}
              <button
                onClick={() => setManualMode(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Or paste a link instead
              </button>
            </>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-xs">Your note (optional)</Label>
            <Textarea
              placeholder="Why it's worth reading..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSave}
            className="w-full cursor-pointer"
            disabled={saving || (!title.trim() && !url.trim())}
          >
            {saving ? 'Sharing...' : 'Share with household'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
