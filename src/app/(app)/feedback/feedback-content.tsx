'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageSquare, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export function FeedbackContent() {
  const [type, setType] = useState<string>('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    if (!type || !details.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    // Try the API route first; falls back to mailto
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, details }),
      })

      if (res.ok) {
        setSubmitted(true)
        return
      }

      // If API fails (e.g. no email configured), fall back to mailto
      const data = await res.json()
      if (data.mailto) {
        window.open(data.mailto, '_blank')
        setSubmitted(true)
        return
      }
    } catch {
      // Fall back to mailto
    }

    // Final fallback: construct mailto directly
    const subject = encodeURIComponent(`[Family Book Club] ${type}`)
    const body = encodeURIComponent(`Type: ${type}\n\nDetails:\n${details}`)
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Thank you!</h1>
        <p className="text-muted-foreground">
          Your feedback has been submitted. We appreciate you helping improve Family Book Club.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle>Submit Feedback</CardTitle>
          </div>
          <CardDescription>
            Found a bug or have an idea? Let us know and we&apos;ll look into it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select feedback type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bug Report">Bug Report</SelectItem>
                <SelectItem value="Feature Request">Feature Request</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Details</Label>
            <Textarea
              id="details"
              placeholder="Describe the issue or feature you'd like to see..."
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={!type || !details.trim()}
          >
            Submit
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
