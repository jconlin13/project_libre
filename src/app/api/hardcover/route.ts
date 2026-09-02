import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { isHardcoverId, openLibraryUrlFor } from '@/lib/book-id'
import { getBookLookupToken } from '@/lib/hardcover-token'
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

/**
 * Shape a locally-stored book to look like a Hardcover one, so the detail page
 * renders it without needing a separate code path. Used for imported books
 * Hardcover couldn't match — no ISBN in the export, or an ISBN it doesn't
 * carry. Fields Hardcover would supply (description, release date) are simply
 * absent, and the UI already handles them being missing.
 */
async function localBookFromSnapshot(userId: string, bookId: string) {
  const snap = await prisma.snapshot.findUnique({
    where: { userId_hardcoverBookId: { userId, hardcoverBookId: bookId } },
  })
  if (!snap) return null

  return {
    id: bookId,
    title: snap.bookTitle || 'Untitled',
    slug: null,
    cached_image: snap.bookCoverUrl ? { url: snap.bookCoverUrl } : null,
    cached_contributors: snap.bookAuthor
      ? [{ author: { name: snap.bookAuthor, slug: null } }]
      : [],
    description: null,
    pages: null,
    release_date: null,
    // Signals to the UI that this book has no Hardcover record behind it
    isLocalOnly: true,
    externalUrl: openLibraryUrlFor(bookId),
  }
}

// Actions that read facts about books rather than a person's own shelves.
// These may use the app's service token, so someone who imported a CSV and has
// no Hardcover account still gets real book pages.
const BOOK_FACT_ACTIONS = new Set(['book', 'search'])

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // A book that never matched Hardcover is served from what the import
    // stored, so every book in a library has a detail page.
    if (action === 'book') {
      const rawId = searchParams.get('bookId')
      if (!rawId) return NextResponse.json({ error: 'bookId required' }, { status: 400 })
      if (!isHardcoverId(rawId)) {
        return NextResponse.json({ data: await localBookFromSnapshot(user.id, rawId) })
      }
    }

    const token = BOOK_FACT_ACTIONS.has(action || '')
      ? await getBookLookupToken(user.id)
      : user.hardcoverApiToken
        ? decrypt(user.hardcoverApiToken)
        : null

    if (!token) {
      return NextResponse.json({ error: 'Hardcover not connected' }, { status: 400 })
    }

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
