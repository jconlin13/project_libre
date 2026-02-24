import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import {
  fetchAllUserBooks,
  searchBooks,
  searchByAuthor,
  fetchCurrentlyReading,
  fetchFinishedBooks,
  fetchWantToRead,
  type HardcoverBook,
  type UserBook,
} from '@/lib/hardcover'

const STATUS_LABELS: Record<number, string> = {
  1: 'wants to read',
  2: 'is reading',
  3: 'has read',
  5: 'did not finish',
}

// Priority order for network results: read > reading > want to read > DNF
const STATUS_PRIORITY: Record<number, number> = { 3: 0, 2: 1, 1: 2, 5: 3 }

type SearchTab = 'all' | 'books' | 'authors' | 'users'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q')?.trim() || '').slice(0, 200)
    const rawTab = searchParams.get('tab') || 'all'
    const validTabs: SearchTab[] = ['all', 'books', 'authors', 'users']
    if (!validTabs.includes(rawTab as SearchTab)) {
      return NextResponse.json({ error: `Invalid tab: ${rawTab}` }, { status: 400 })
    }
    const tab = rawTab as SearchTab
    const perPage = Math.min(Math.max(parseInt(searchParams.get('perPage') || '10', 10) || 10, 1), 50)

    if (!q || q.length < 3) {
      return NextResponse.json({ data: { myBooks: [], recommendedBooks: [], hardcoverResults: [], authorBookResults: [], networkBooks: [], matchedUsers: [] } })
    }

    const qLower = q.toLowerCase()

    if (!user.hardcoverApiToken) {
      return NextResponse.json({ data: { myBooks: [], recommendedBooks: [], hardcoverResults: [], authorBookResults: [], networkBooks: [], matchedUsers: [] } })
    }

    const token = decrypt(user.hardcoverApiToken)

    // Build parallel API calls based on active tab
    let allMyBooks: UserBook[] = []
    let hardcoverResults: HardcoverBook[] = []
    let authorBookResults: HardcoverBook[] = []
    let recommendedBooks: Array<{
      id: string
      hardcoverBookId: string
      bookTitle: string | null
      bookAuthor: string | null
      bookCoverUrl: string | null
      note: string | null
      fromUser: { id: string; name: string; avatarUrl: string | null }
    }> = []

    try {
      if (tab === 'all' || tab === 'books') {
        const results = await Promise.all([
          fetchAllUserBooks(token),
          searchBooks(token, q, perPage),
        ])
        allMyBooks = results[0]
        hardcoverResults = results[1]
      }

      if (tab === 'authors') {
        // Also fetch user's books to mark which ones they already have
        const results = await Promise.all([
          fetchAllUserBooks(token),
          searchByAuthor(token, q, perPage),
        ])
        allMyBooks = results[0]
        authorBookResults = results[1]
      }

      // Fetch pending recommendations matching search query
      if (tab === 'all' || tab === 'books') {
        const recommendations = await prisma.recommendation.findMany({
          where: {
            toUserId: user.id,
            status: 'pending',
          },
          include: {
            fromUser: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
        recommendedBooks = recommendations
          .filter((r) => {
            const title = r.bookTitle?.toLowerCase() || ''
            const author = r.bookAuthor?.toLowerCase() || ''
            return title.includes(qLower) || author.includes(qLower)
          })
          .map((r) => ({
            id: r.id,
            hardcoverBookId: r.hardcoverBookId,
            bookTitle: r.bookTitle,
            bookAuthor: r.bookAuthor,
            bookCoverUrl: r.bookCoverUrl,
            note: r.note,
            fromUser: r.fromUser,
          }))
      }
    } catch (err) {
      console.error('Search: Hardcover API error:', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Hardcover API error' },
        { status: 502 }
      )
    }

    // Filter user's own books by query
    const myBooks = allMyBooks.filter((ub: UserBook) => {
      const title = ub.book.title?.toLowerCase() || ''
      const author = ub.book.cached_contributors?.[0]?.author?.name?.toLowerCase() || ''
      return title.includes(qLower) || author.includes(qLower)
    })

    // Filter out hardcover results that are already in myBooks
    const myBookIds = new Set(myBooks.map((ub: UserBook) => ub.book.id))
    const filteredHardcover = hardcoverResults.filter(
      (book: HardcoverBook) => !myBookIds.has(book.id)
    )

    // Filter out author book results that are already in myBooks
    const filteredAuthorBooks = authorBookResults.filter(
      (book: HardcoverBook) => !myBookIds.has(book.id)
    )

    // Network / Users search
    const networkBooks: Array<{
      book: HardcoverBook
      member: { id: string; name: string }
      statusLabel: string
      statusPriority: number
    }> = []

    const matchedUsers: Array<{
      id: string
      name: string
      avatarUrl: string | null
    }> = []

    // Get household members
    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { householdId: true },
    })
    const householdIds = memberships.map((m) => m.householdId)

    if (householdIds.length > 0) {
      const householdMembers = await prisma.householdMember.findMany({
        where: {
          householdId: { in: householdIds },
          userId: { not: user.id },
        },
        include: { user: true },
      })

      // Deduplicate members across households
      const uniqueMembers = [
        ...new Map(householdMembers.map((hm) => [hm.userId, hm])).values(),
      ]

      // Users tab: return members matching the query by name
      if (tab === 'all' || tab === 'users') {
        for (const hm of uniqueMembers) {
          if (hm.user.name.toLowerCase().includes(qLower)) {
            matchedUsers.push({
              id: hm.user.id,
              name: hm.user.name,
              avatarUrl: hm.user.avatarUrl,
            })
          }
        }
      }

      // Network book search (for All and Books tabs)
      if (tab === 'all') {
        const memberSearches = uniqueMembers
          .filter((hm) => hm.user.hardcoverApiToken)
          .map(async (hm) => {
            try {
              const memberToken = decrypt(hm.user.hardcoverApiToken!)
              const [reading, finished, wantToRead] = await Promise.all([
                fetchCurrentlyReading(memberToken),
                fetchFinishedBooks(memberToken, 100),
                fetchWantToRead(memberToken),
              ])

              const allMemberBooks = [
                ...reading.map((ub: UserBook) => ({ ...ub, status_id: 2 })),
                ...finished.map((ub: UserBook) => ({ ...ub, status_id: 3 })),
                ...wantToRead.map((ub: UserBook) => ({ ...ub, status_id: 1 })),
              ]

              // Filter member books matching the search query
              const matches = allMemberBooks.filter((ub: UserBook) => {
                const title = ub.book.title?.toLowerCase() || ''
                const author = ub.book.cached_contributors?.[0]?.author?.name?.toLowerCase() || ''
                return title.includes(qLower) || author.includes(qLower)
              })

              for (const match of matches) {
                networkBooks.push({
                  book: match.book,
                  member: { id: hm.user.id, name: hm.user.name },
                  statusLabel: STATUS_LABELS[match.status_id] || 'has',
                  statusPriority: STATUS_PRIORITY[match.status_id] ?? 99,
                })
              }
            } catch (err) {
              // Skip members whose tokens fail
              console.error(`Failed to search member ${hm.user.name}:`, err)
            }
          })

        await Promise.all(memberSearches)
      }
    }

    // Sort network books by priority (read first, then reading, then want to read)
    networkBooks.sort((a, b) => a.statusPriority - b.statusPriority)

    return NextResponse.json({
      data: {
        myBooks: (tab === 'all' || tab === 'books') ? myBooks : [],
        hardcoverResults: (tab === 'all' || tab === 'books') ? filteredHardcover : [],
        authorBookResults: tab === 'authors' ? filteredAuthorBooks : [],
        networkBooks: tab === 'all' ? networkBooks : [],
        matchedUsers: (tab === 'all' || tab === 'users') ? matchedUsers : [],
        recommendedBooks: (tab === 'all' || tab === 'books') ? recommendedBooks : [],
      },
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
