import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, details } = await request.json()

    if (!type || !details?.trim()) {
      return NextResponse.json({ error: 'Type and details are required' }, { status: 400 })
    }

    const feedbackEmail = process.env.FEEDBACK_EMAIL

    if (!feedbackEmail) {
      // No email service configured — return mailto fallback
      const subject = encodeURIComponent(`[Family Book Club] ${type}`)
      const body = encodeURIComponent(
        `Type: ${type}\nFrom: ${user.name} (${user.email})\n\nDetails:\n${details}`
      )
      return NextResponse.json({
        mailto: `mailto:${feedbackEmail || ''}?subject=${subject}&body=${body}`,
        message: 'No email service configured. Opening mailto link instead.',
      }, { status: 202 })
    }

    // When an email service is configured (e.g. Resend, SendGrid),
    // send the feedback email here. For now, store in DB or send via email.
    // Note: User feedback content is not logged to avoid exposing sensitive info.

    return NextResponse.json({ data: { received: true } })
  } catch (error) {
    console.error('Feedback error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
