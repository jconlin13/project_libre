import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import {
  fetchAllUserBooks,
  searchBooks,
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

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ data: { myBooks: [], hardcoverResults: [], networkBooks: [] } })
    }

    const qLower = q.toLowerCase()

    if (!user.hardcoverApiToken) {
      return NextResponse.json({ data: { myBooks: [], hardcoverResults: [], networkBooks: [] } })
    }

    const token = decrypt(user.hardcoverApiToken)

    // 1. Fetch user's own books and filter client-side
    const [allMyBooks, hardcoverResults] = await Promise.all([
      fetchAllUserBooks(token),
      searchBooks(token, q),
    ])

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

    // 2. Fetch network member books
    const networkBooks: Array<{
      book: HardcoverBook
      member: { id: string; name: string }
      statusLabel: string
      statusPriority: number
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

      // For each member with a Hardcover connection, search their books
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

    // Sort network books by priority (read first, then reading, then want to read)
    networkBooks.sort((a, b) => a.statusPriority - b.statusPriority)

    return NextResponse.json({
      data: {
        myBooks,
        hardcoverResults: filteredHardcover,
        networkBooks,
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
