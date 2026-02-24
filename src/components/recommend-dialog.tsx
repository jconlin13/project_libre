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

interface RecommendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  bookId: string
  bookTitle: string
  bookAuthor: string
  bookCoverUrl: string | null
  onSuccess?: () => void
}

export function RecommendDialog({
  open,
  onOpenChange,
  userId,
  bookId,
  bookTitle,
  bookAuthor,
  bookCoverUrl,
  onSuccess,
}: RecommendDialogProps) {
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  // Fetch household members when dialog opens
  useEffect(() => {
    if (!open) return
    setLoadingMembers(true)
    fetch('/api/households')
      .then(r => r.json())
      .then(data => {
        if (data.data) {
          const allMembers = data.data.flatMap((h: any) => h.members).filter((m: any) => m.id !== userId)
          const unique: HouseholdMember[] = [...new Map(allMembers.map((m: any) => [m.id, m])).values()]
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
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: selectedMemberId,
          hardcoverBookId: bookId,
          bookTitle,
          bookAuthor,
          bookCoverUrl,
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
          <DialogTitle>Recommend this Book</DialogTitle>
          <DialogDescription>
            Send &ldquo;{bookTitle}&rdquo; to a family member.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Member selection */}
          <div className="space-y-2">
            <Label>Recommend to</Label>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No household members found. Join or create a household first.
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

          {/* Note */}
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              placeholder="I think you'd love this because..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {/* Submit */}
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
