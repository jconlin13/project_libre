import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { fetchUserProfile } from '@/lib/hardcover'
import { STATUS_WANT, STATUS_READING, STATUS_READ } from '@/lib/group-data'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const action = searchParams.get('action')

    if (!memberId) {
      return NextResponse.json({ error: 'memberId required' }, { status: 400 })
    }

    // Verify same household
    const currentHouseholds = await prisma.householdMember.findMany({
      where: { userId: currentUser.id },
      select: { householdId: true }
    })
    const householdIds = currentHouseholds.map(h => h.householdId)

    const isSameHousehold = await prisma.householdMember.findFirst({
      where: {
        userId: memberId,
        householdId: { in: householdIds }
      }
    })

    if (!isSameHousehold) {
      return NextResponse.json({ error: 'Not in same group' }, { status: 403 })
    }

    const member = await prisma.user.findUnique({ where: { id: memberId } })

    // Shelves come from the member's snapshots, not a live Hardcover call.
    // Snapshot is the record of truth — it carries imports and in-app changes
    // that Hardcover may not have — and it's the only source for a member with
    // no Hardcover account at all, who would otherwise look like they own
    // nothing. Profile still needs the live call, since it isn't stored.
    if (action === 'profile') {
      if (!member?.hardcoverApiToken) {
        return NextResponse.json({ error: 'Member has no Hardcover connection' }, { status: 400 })
      }
      return NextResponse.json({ data: await fetchUserProfile(decrypt(member.hardcoverApiToken)) })
    }

    const statusForAction: Record<string, number> = {
      reading: STATUS_READING,
      finished: STATUS_READ,
      'want-to-read': STATUS_WANT,
    }
    const statusId = statusForAction[action || '']
    if (!statusId) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const limit = Number(searchParams.get('limit')) || 50
    const snapshots = await prisma.snapshot.findMany({
      where: { userId: memberId, statusId },
      orderBy: statusId === STATUS_READ ? { lastReadDate: 'desc' } : { updatedAt: 'desc' },
      take: limit,
    })

    // Shaped like Hardcover's user_books so existing callers keep working
    const data = snapshots.map(s => ({
      id: s.id,
      status_id: s.statusId,
      rating: s.rating,
      last_read_date: s.lastReadDate,
      date_added: s.dateAdded,
      book: {
        id: s.hardcoverBookId,
        title: s.bookTitle,
        slug: null,
        cached_image: s.bookCoverUrl ? { url: s.bookCoverUrl } : null,
        cached_contributors: s.bookAuthor ? [{ author: { name: s.bookAuthor, slug: null } }] : [],
      },
      user_book_reads: s.progressPct != null ? [{ progress: s.progressPct, progress_pages: null }] : [],
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Member data error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
