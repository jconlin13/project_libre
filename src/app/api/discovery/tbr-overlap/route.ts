import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Books that 2+ household members (including the caller) all want to read.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { householdId: true }
    })
    const householdIds = memberships.map(m => m.householdId)
    if (householdIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const allMembers = await prisma.householdMember.findMany({
      where: { householdId: { in: householdIds } },
      select: { userId: true }
    })
    const memberIds = [...new Set(allMembers.map(m => m.userId))]

    // All Want to Read snapshots across the household
    const snapshots = await prisma.snapshot.findMany({
      where: {
        userId: { in: memberIds },
        statusId: 1,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, avatarIcon: true } }
      }
    })

    // Group by book; keep books 2+ members want
    const byBook = new Map<string, {
      hardcoverBookId: string
      bookTitle: string | null
      bookAuthor: string | null
      bookCoverUrl: string | null
      wanters: Array<{ userId: string; name: string; avatarUrl: string | null; avatarIcon: string | null }>
    }>()

    for (const s of snapshots) {
      let entry = byBook.get(s.hardcoverBookId)
      if (!entry) {
        entry = {
          hardcoverBookId: s.hardcoverBookId,
          bookTitle: s.bookTitle,
          bookAuthor: s.bookAuthor,
          bookCoverUrl: s.bookCoverUrl,
          wanters: [],
        }
        byBook.set(s.hardcoverBookId, entry)
      }
      entry.wanters.push({
        userId: s.user.id,
        name: s.user.name,
        avatarUrl: s.user.avatarUrl,
        avatarIcon: s.user.avatarIcon,
      })
    }

    const overlaps = [...byBook.values()]
      .filter(b => b.wanters.length >= 2)
      .map(b => ({ ...b, includesMe: b.wanters.some(w => w.userId === user.id) }))
      // Books the caller also wants come first, then by how many members want it
      .sort((a, b) => {
        if (a.includesMe !== b.includesMe) return a.includesMe ? -1 : 1
        return b.wanters.length - a.wanters.length
      })
      .slice(0, 10)

    return NextResponse.json({ data: overlaps })
  } catch (error) {
    console.error('TBR overlap error:', error)
    return NextResponse.json({ error: 'Failed to fetch TBR overlap' }, { status: 500 })
  }
}
