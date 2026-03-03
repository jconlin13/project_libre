import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { extractOGMetadata } from '@/lib/og-metadata'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url).searchParams.get('url')
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const metadata = await extractOGMetadata(url)

    return NextResponse.json({ data: metadata })
  } catch (error) {
    console.error('Article preview error:', error)
    return NextResponse.json({ error: 'Failed to preview URL' }, { status: 500 })
  }
}
