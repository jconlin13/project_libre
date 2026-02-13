import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
import {
  fetchCurrentlyReading,
  fetchFinishedBooks,
  fetchWantToRead,
  fetchDidNotFinish,
  fetchAllUserBooks,
  fetchUserProfile,
  fetchBookById,
  searchBooks,
  addBookToWantToRead
} from '@/lib/hardcover'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.hardcoverApiToken) {
      return NextResponse.json({ error: 'Hardcover not connected' }, { status: 400 })
    }

    const token = decrypt(user.hardcoverApiToken)
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'add-book': {
        const { bookId } = body
        if (!bookId) return NextResponse.json({ error: 'bookId required' }, { status: 400 })
        const data = await addBookToWantToRead(token, Number(bookId))
        return NextResponse.json({ data })
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Hardcover API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.hardcoverApiToken) {
      return NextResponse.json({ error: 'Hardcover not connected' }, { status: 400 })
    }

    const token = decrypt(user.hardcoverApiToken)
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    let data
    switch (action) {
      case 'profile':
        data = await fetchUserProfile(token)
        break
      case 'reading':
        data = await fetchCurrentlyReading(token)
        break
      case 'finished':
        data = await fetchFinishedBooks(token, Number(searchParams.get('limit')) || 20)
        break
      case 'want-to-read':
        data = await fetchWantToRead(token)
        break
      case 'dnf':
        data = await fetchDidNotFinish(token)
        break
      case 'book':
        const bookId = searchParams.get('bookId')
        if (!bookId) return NextResponse.json({ error: 'bookId required' }, { status: 400 })
        data = await fetchBookById(token, Number(bookId))
        break
      case 'all-books':
        data = await fetchAllUserBooks(token)
        break
      case 'search':
        const query = searchParams.get('q')
        if (!query) return NextResponse.json({ error: 'q required' }, { status: 400 })
        data = await searchBooks(token, query)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Hardcover API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
