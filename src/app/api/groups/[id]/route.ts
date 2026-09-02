import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  STATUS_WANT,
  STATUS_READING,
  STATUS_READ,
  getGroupRole,
  getScoredBooksForMembers,
  toMemberSummary,
} from '@/lib/group-data'

export const dynamic = 'force-dynamic'

const SHELF_LIMIT = 6

// Group home: roster with what each member is reading now, plus the three
// sidebar shelves (most loved, recently finished, want to read). All served
// from cached snapshots/rankings — no live Hardcover calls.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: groupId } = await params
    const myRole = await getGroupRole(user.id, groupId)
    if (!myRole) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    const group = await prisma.household.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: true } } },
    })
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const memberIds = group.members.map(m => m.userId)
    const memberById = new Map(group.members.map(m => [m.userId, m.user]))

    const [snapshots, scoredBooks] = await Promise.all([
      prisma.snapshot.findMany({ where: { userId: { in: memberIds } } }),
      getScoredBooksForMembers(memberIds),
    ])

    // Roster — each member with what they're reading right now
    const readingByUser = new Map<string, typeof snapshots>()
    for (const s of snapshots) {
      if (s.statusId !== STATUS_READING) continue
      const list = readingByUser.get(s.userId) || []
      list.push(s)
      readingByUser.set(s.userId, list)
    }

    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const members = group.members.map(m => ({
      ...toMemberSummary(m.user),
      role: m.role,
      hardcoverConnected: !!m.user.hardcoverApiToken,
      booksThisYear: snapshots.filter(
        s => s.userId === m.userId && s.statusId === STATUS_READ && s.lastReadDate && s.lastReadDate >= yearStart
      ).length,
      currentlyReading: (readingByUser.get(m.userId) || []).slice(0, 3).map(s => ({
        hardcoverBookId: s.hardcoverBookId,
        bookTitle: s.bookTitle,
        bookAuthor: s.bookAuthor,
        bookCoverUrl: s.bookCoverUrl,
        progressPct: s.progressPct,
      })),
    }))

    // Shelf: most loved — highest display score in the group, best entry per book
    const bestByBook = new Map<string, (typeof scoredBooks)[number]>()
    for (const b of scoredBooks) {
      const existing = bestByBook.get(b.hardcoverBookId)
      if (!existing || b.displayScore > existing.displayScore) {
        bestByBook.set(b.hardcoverBookId, b)
      }
    }
    const mostLoved = [...bestByBook.values()]
      .sort((a, b) => b.displayScore - a.displayScore)
      .slice(0, SHELF_LIMIT)
      .map(b => {
        const u = memberById.get(b.userId)
        return {
          hardcoverBookId: b.hardcoverBookId,
          bookTitle: b.bookTitle,
          bookAuthor: b.bookAuthor,
          bookCoverUrl: b.bookCoverUrl,
          displayScore: b.displayScore,
          by: u ? toMemberSummary(u) : null,
        }
      })

    // Shelf: recently finished — newest last_read_date first
    const recentlyFinished = snapshots
      .filter(s => s.statusId === STATUS_READ && s.lastReadDate)
      .sort((a, b) => (b.lastReadDate?.getTime() ?? 0) - (a.lastReadDate?.getTime() ?? 0))
      .slice(0, SHELF_LIMIT)
      .map(s => {
        const u = memberById.get(s.userId)
        return {
          hardcoverBookId: s.hardcoverBookId,
          bookTitle: s.bookTitle,
          bookAuthor: s.bookAuthor,
          bookCoverUrl: s.bookCoverUrl,
          lastReadDate: s.lastReadDate,
          by: u ? toMemberSummary(u) : null,
        }
      })

    // Shelf: want to read — books the most members want, ties broken by title
    const wantByBook = new Map<string, { snapshot: (typeof snapshots)[number]; userIds: string[] }>()
    for (const s of snapshots) {
      if (s.statusId !== STATUS_WANT) continue
      const entry = wantByBook.get(s.hardcoverBookId)
      if (entry) entry.userIds.push(s.userId)
      else wantByBook.set(s.hardcoverBookId, { snapshot: s, userIds: [s.userId] })
    }
    const wantToRead = [...wantByBook.values()]
      .sort((a, b) => b.userIds.length - a.userIds.length)
      .slice(0, SHELF_LIMIT)
      .map(({ snapshot, userIds }) => ({
        hardcoverBookId: snapshot.hardcoverBookId,
        bookTitle: snapshot.bookTitle,
        bookAuthor: snapshot.bookAuthor,
        bookCoverUrl: snapshot.bookCoverUrl,
        wantedBy: userIds
          .map(id => memberById.get(id))
          .filter((u): u is NonNullable<typeof u> => !!u)
          .map(toMemberSummary),
      }))

    return NextResponse.json({
      data: {
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
        myRole,
        members,
        shelves: { mostLoved, recentlyFinished, wantToRead },
      }
    })
  } catch (error) {
    console.error('Group detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 })
  }
}
