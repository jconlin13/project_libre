import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  initialEloFromBucket,
  getComparisonCount,
  selectNextComparison,
  calculateDisplayScores,
  type RankingEntry,
} from '@/lib/ranking'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { hardcoverBookId, bucket, bookTitle, bookAuthor, bookCoverUrl } = await request.json()

    if (!hardcoverBookId || !bucket) {
      return NextResponse.json({ error: 'hardcoverBookId and bucket are required' }, { status: 400 })
    }

    const validBuckets = ['loved', 'liked', 'okay', 'disliked']
    if (!validBuckets.includes(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket. Use: loved, liked, okay, disliked' }, { status: 400 })
    }

    const initialElo = initialEloFromBucket(bucket)

    // Upsert the ranking (in case reranking or re-initializing)
    const ranking = await prisma.bookRanking.upsert({
      where: {
        userId_hardcoverBookId: {
          userId: user.id,
          hardcoverBookId: String(hardcoverBookId),
        },
      },
      create: {
        userId: user.id,
        hardcoverBookId: String(hardcoverBookId),
        eloScore: initialElo,
        bookTitle: bookTitle || null,
        bookAuthor: bookAuthor || null,
        bookCoverUrl: bookCoverUrl || null,
      },
      update: {
        eloScore: initialElo,
        manualOverride: null, // Clear any manual override when re-ranking comparatively
        bookTitle: bookTitle || null,
        bookAuthor: bookAuthor || null,
        bookCoverUrl: bookCoverUrl || null,
      },
    })

    // Get existing rankings for comparison candidates (exclude the new book)
    const existingRankings = await prisma.bookRanking.findMany({
      where: {
        userId: user.id,
        hardcoverBookId: { not: String(hardcoverBookId) },
      },
    })

    const candidates: RankingEntry[] = existingRankings.map(r => ({
      hardcoverBookId: r.hardcoverBookId,
      eloScore: r.eloScore,
      manualOverride: r.manualOverride,
      comparisonCount: r.comparisonCount,
      bookTitle: r.bookTitle,
      bookAuthor: r.bookAuthor,
      bookCoverUrl: r.bookCoverUrl,
    }))

    const totalComparisons = getComparisonCount(candidates.length)
    const nextComparison = totalComparisons > 0
      ? selectNextComparison(initialElo, candidates, new Set())
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
    console.error('Ranking init error:', error)
    return NextResponse.json({ error: 'Failed to initialize ranking' }, { status: 500 })
  }
}
