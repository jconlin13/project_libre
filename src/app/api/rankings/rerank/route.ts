import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getComparisonCount,
  selectNextComparison,
  type RankingEntry,
} from '@/lib/ranking'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { hardcoverBookId } = await request.json()

    if (!hardcoverBookId) {
      return NextResponse.json({ error: 'hardcoverBookId is required' }, { status: 400 })
    }

    // Get the existing ranking
    const ranking = await prisma.bookRanking.findUnique({
      where: {
        userId_hardcoverBookId: {
          userId: user.id,
          hardcoverBookId: String(hardcoverBookId),
        },
      },
    })

    if (!ranking) {
      return NextResponse.json({ error: 'Book not found in rankings' }, { status: 404 })
    }

    // Clear manual override when reranking
    if (ranking.manualOverride !== null) {
      await prisma.bookRanking.update({
        where: { id: ranking.id },
        data: { manualOverride: null },
      })
    }

    // Get comparison candidates (exclude the current book)
    const candidates = await prisma.bookRanking.findMany({
      where: {
        userId: user.id,
        hardcoverBookId: { not: String(hardcoverBookId) },
      },
    })

    const candidateEntries: RankingEntry[] = candidates.map(r => ({
      hardcoverBookId: r.hardcoverBookId,
      eloScore: r.eloScore,
      manualOverride: r.manualOverride,
      comparisonCount: r.comparisonCount,
      bookTitle: r.bookTitle,
      bookAuthor: r.bookAuthor,
      bookCoverUrl: r.bookCoverUrl,
    }))

    const totalComparisons = getComparisonCount(candidateEntries.length)
    const nextComparison = totalComparisons > 0
      ? selectNextComparison(ranking.eloScore, candidateEntries, new Set())
      : null

    return NextResponse.json({
      data: {
        ranking: {
          hardcoverBookId: ranking.hardcoverBookId,
          eloScore: ranking.eloScore,
          bookTitle: ranking.bookTitle,
          bookAuthor: ranking.bookAuthor,
          bookCoverUrl: ranking.bookCoverUrl,
        },
        nextComparison,
        totalComparisons,
        comparisonsCompleted: 0,
      },
    })
  } catch (error) {
    console.error('Rerank error:', error)
    return NextResponse.json({ error: 'Failed to start rerank' }, { status: 500 })
  }
}
