import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateDisplayScores, type RankingEntry } from '@/lib/ranking'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rankings = await prisma.bookRanking.findMany({
      where: { userId: user.id },
      orderBy: { eloScore: 'desc' },
    })

    const entries: RankingEntry[] = rankings.map(r => ({
      hardcoverBookId: r.hardcoverBookId,
      eloScore: r.eloScore,
      manualOverride: r.manualOverride,
      comparisonCount: r.comparisonCount,
      bookTitle: r.bookTitle,
      bookAuthor: r.bookAuthor,
      bookCoverUrl: r.bookCoverUrl,
    }))

    const displayScores = calculateDisplayScores(entries)

    const data = rankings.map(r => ({
      hardcoverBookId: r.hardcoverBookId,
      displayScore: displayScores.get(r.hardcoverBookId) ?? null,
      eloScore: r.eloScore,
      manualOverride: r.manualOverride,
      comparisonCount: r.comparisonCount,
      bookTitle: r.bookTitle,
      bookAuthor: r.bookAuthor,
      bookCoverUrl: r.bookCoverUrl,
    }))

    // Sort by display score descending
    data.sort((a, b) => (b.displayScore ?? 0) - (a.displayScore ?? 0))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Rankings error:', error)
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 })
  }
}
