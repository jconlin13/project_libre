'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface HouseholdMember {
  id: string
  name: string
  avatarUrl: string | null
}

interface ArticleRecommendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  articleId: string
  articleTitle: string
  onSuccess?: () => void
}

export function ArticleRecommendDialog({
  open,
  onOpenChange,
  userId,
  articleId,
  articleTitle,
  onSuccess,
}: ArticleRecommendDialogProps) {
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingMembers(true)
    fetch('/api/households')
      .then(r => r.json())
      .then(data => {
        if (data.data) {
          const allMembers = data.data.flatMap((h: any) => h.members).filter((m: any) => m.id !== userId)
          const unique = [...new Map(allMembers.map((m: any) => [m.id, m])).values()] as HouseholdMember[]
          setMembers(unique)
        }
      })
      .catch(err => console.error('Failed to fetch members:', err))
      .finally(() => setLoadingMembers(false))
  }, [open, userId])

  async function handleSend() {
    if (!selectedMemberId) {
      toast.error('Select a family member')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/articles/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          toUserId: selectedMemberId,
          note: note || null,
        }),
      })
      if (res.ok) {
        const member = members.find(m => m.id === selectedMemberId)
        toast.success(`Recommended to ${member?.name}!`)
        onOpenChange(false)
        setSelectedMemberId('')
        setNote('')
        onSuccess?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to send recommendation')
      }
    } catch {
      toast.error('Failed to send recommendation')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recommend Article</DialogTitle>
          <DialogDescription>
            Send &ldquo;{articleTitle}&rdquo; to a family member.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Recommend to</Label>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No household members found.
              </p>
            ) : (
              <div className="space-y-1">
                {members.map(member => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMemberId(member.id)}
                    className={`w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-colors cursor-pointer ${
                      selectedMemberId === member.id
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted border border-transparent'
                    }`}
                  >
                    <Avatar>
                      <AvatarImage src={member.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {member.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium flex-1">{member.name}</span>
                    {selectedMemberId === member.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              placeholder="You'd find this interesting because..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            onClick={handleSend}
            className="w-full cursor-pointer"
            disabled={!selectedMemberId || sending || members.length === 0}
          >
            {sending ? 'Sending...' : 'Send Recommendation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
