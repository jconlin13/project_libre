import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFriendGraph, getPendingRequests } from '@/lib/friends'
import { STATUS_READ, STATUS_READING } from '@/lib/group-data'

export const dynamic = 'force-dynamic'

// Friends organized by group, with a reading snapshot for each person.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [{ groups, directOnly, all }, requests] = await Promise.all([
      getFriendGraph(user.id),
      getPendingRequests(user.id),
    ])

    // One query for everyone's reading state, then fan out in memory
    const friendIds = all.map(f => f.id)
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const snapshots = friendIds.length
      ? await prisma.snapshot.findMany({
          where: {
            userId: { in: friendIds },
            OR: [
              { statusId: STATUS_READING },
              { statusId: STATUS_READ, lastReadDate: { gte: yearStart } },
            ],
          },
        })
      : []

    const statsFor = (friendId: string) => {
      const mine = snapshots.filter(s => s.userId === friendId)
      return {
        booksThisYear: mine.filter(s => s.statusId === STATUS_READ).length,
        currentlyReading: mine
          .filter(s => s.statusId === STATUS_READING)
          .slice(0, 2)
          .map(s => ({
            hardcoverBookId: s.hardcoverBookId,
            bookTitle: s.bookTitle,
            bookAuthor: s.bookAuthor,
            bookCoverUrl: s.bookCoverUrl,
            progressPct: s.progressPct,
          })),
      }
    }

    const decorate = (f: (typeof all)[number]) => ({ ...f, ...statsFor(f.id) })

    return NextResponse.json({
      data: {
        groups: groups.map(g => ({ ...g, friends: g.friends.map(decorate) })),
        directOnly: directOnly.map(decorate),
        totalFriends: all.length,
        requests,
      },
    })
  } catch (error) {
    console.error('Friends error:', error)
    return NextResponse.json({ error: 'Failed to fetch friends' }, { status: 500 })
  }
}
