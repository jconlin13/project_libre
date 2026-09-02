import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { STATUS_WANT, toMemberSummary } from '@/lib/group-data'

export const dynamic = 'force-dynamic'

// Books the caller wants to read that someone else in one of their groups also
// wants. Returned as one entry per (book, person) pairing so the UI can
// spotlight a single "you and <person> both want this" moment and offer to
// nudge that specific person. Pass ?groupId= to scope to one group.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const groupId = new URL(request.url).searchParams.get('groupId')

    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      include: { household: { include: { members: { include: { user: true } } } } },
    })
    const myGroups = groupId
      ? memberships.filter(m => m.householdId === groupId)
      : memberships

    if (myGroups.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Map each other member to the group they share with the caller
    const sharedGroupOf = new Map<string, { id: string; name: string }>()
    const otherMembers = new Map<string, ReturnType<typeof toMemberSummary>>()
    for (const m of myGroups) {
      for (const hm of m.household.members) {
        if (hm.userId === user.id) continue
        if (!sharedGroupOf.has(hm.userId)) {
          sharedGroupOf.set(hm.userId, { id: m.household.id, name: m.household.name })
          otherMembers.set(hm.userId, toMemberSummary(hm.user))
        }
      }
    }
    if (otherMembers.size === 0) {
      return NextResponse.json({ data: [] })
    }

    const [myWants, theirWants] = await Promise.all([
      prisma.snapshot.findMany({
        where: { userId: user.id, statusId: STATUS_WANT },
      }),
      prisma.snapshot.findMany({
        where: { userId: { in: [...otherMembers.keys()] }, statusId: STATUS_WANT },
      }),
    ])

    const myWantIds = new Map(myWants.map(s => [s.hardcoverBookId, s]))

    // One entry per (book, other person) pair the caller shares a want with
    const pairs = theirWants
      .filter(s => myWantIds.has(s.hardcoverBookId))
      .map(s => {
        const mine = myWantIds.get(s.hardcoverBookId)!
        const person = otherMembers.get(s.userId)!
        const group = sharedGroupOf.get(s.userId)!
        return {
          hardcoverBookId: s.hardcoverBookId,
          // Prefer whichever snapshot has richer metadata
          bookTitle: mine.bookTitle || s.bookTitle,
          bookAuthor: mine.bookAuthor || s.bookAuthor,
          bookCoverUrl: mine.bookCoverUrl || s.bookCoverUrl,
          person,
          group,
        }
      })

    // Stable ordering so the spotlight doesn't reshuffle on every load
    pairs.sort((a, b) =>
      (a.bookTitle || '').localeCompare(b.bookTitle || '') ||
      a.person.name.localeCompare(b.person.name)
    )

    return NextResponse.json({ data: pairs.slice(0, 20) })
  } catch (error) {
    console.error('TBR overlap error:', error)
    return NextResponse.json({ error: 'Failed to fetch shared want-to-read books' }, { status: 500 })
  }
}
