import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  calculateEloUpdate,
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

    const { bookAId, bookBId, winnerId, currentBookId, alreadyCompared, totalComparisons } = await request.json()

    if (!bookAId || !bookBId) {
      return NextResponse.json({ error: 'bookAId and bookBId are required' }, { status: 400 })
    }

    const isDraw = winnerId === null
    if (!isDraw && winnerId !== bookAId && winnerId !== bookBId) {
      return NextResponse.json({ error: 'winnerId must be bookAId, bookBId, or null (draw)' }, { status: 400 })
    }

    // Fetch both rankings
    const [rankingA, rankingB] = await Promise.all([
      prisma.bookRanking.findUnique({
        where: { userId_hardcoverBookId: { userId: user.id, hardcoverBookId: String(bookAId) } },
      }),
      prisma.bookRanking.findUnique({
        where: { userId_hardcoverBookId: { userId: user.id, hardcoverBookId: String(bookBId) } },
      }),
    ])

    if (!rankingA || !rankingB) {
      return NextResponse.json({ error: 'One or both books not found in rankings' }, { status: 404 })
    }

    // Calculate new Elo scores
    const actualWinnerElo = isDraw ? rankingA.eloScore : (winnerId === bookAId ? rankingA.eloScore : rankingB.eloScore)
    const actualLoserElo = isDraw ? rankingB.eloScore : (winnerId === bookAId ? rankingB.eloScore : rankingA.eloScore)
    const [newWinnerElo, newLoserElo] = calculateEloUpdate(actualWinnerElo, actualLoserElo, isDraw)

    // Update both rankings and create comparison record
    const actualWinnerId = isDraw ? bookAId : winnerId
    const actualLoserId = isDraw ? bookBId : (winnerId === bookAId ? bookBId : bookAId)

    await Promise.all([
      prisma.bookRanking.update({
        where: { userId_hardcoverBookId: { userId: user.id, hardcoverBookId: String(isDraw ? bookAId : winnerId) } },
        data: {
          eloScore: newWinnerElo,
          comparisonCount: { increment: 1 },
        },
      }),
      prisma.bookRanking.update({
        where: { userId_hardcoverBookId: { userId: user.id, hardcoverBookId: String(isDraw ? bookBId : (winnerId === bookAId ? bookBId : bookAId)) } },
        data: {
          eloScore: newLoserElo,
          comparisonCount: { increment: 1 },
        },
      }),
      prisma.bookComparison.create({
        data: {
          userId: user.id,
          winnerBookId: String(actualWinnerId),
          loserBookId: String(actualLoserId),
          isDraw,
        },
      }),
    ])

    // Calculate next comparison if needed
    const comparedSet = new Set<string>(alreadyCompared || [])
    comparedSet.add(String(bookAId === currentBookId ? bookBId : bookAId))

    const comparisonsCompleted = comparedSet.size

    // Get the current book's updated Elo for selecting next comparison
    const updatedCurrentRanking = await prisma.bookRanking.findUnique({
      where: { userId_hardcoverBookId: { userId: user.id, hardcoverBookId: String(currentBookId) } },
    })

    let nextComparison: RankingEntry | null = null
    if (comparisonsCompleted < totalComparisons && updatedCurrentRanking) {
      const candidates = await prisma.bookRanking.findMany({
        where: {
          userId: user.id,
          hardcoverBookId: { not: String(currentBookId) },
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

      nextComparison = selectNextComparison(updatedCurrentRanking.eloScore, candidateEntries, comparedSet)
    }

    // Calculate updated display scores for the response
    const allRankings = await prisma.bookRanking.findMany({
      where: { userId: user.id },
    })
    const allEntries: RankingEntry[] = allRankings.map(r => ({
      hardcoverBookId: r.hardcoverBookId,
      eloScore: r.eloScore,
      manualOverride: r.manualOverride,
      comparisonCount: r.comparisonCount,
      bookTitle: r.bookTitle,
      bookAuthor: r.bookAuthor,
      bookCoverUrl: r.bookCoverUrl,
    }))
    const displayScores = calculateDisplayScores(allEntries)

    return NextResponse.json({
      data: {
        updatedScores: {
          [bookAId]: displayScores.get(String(bookAId)) ?? null,
          [bookBId]: displayScores.get(String(bookBId)) ?? null,
        },
        nextComparison,
        comparisonsCompleted,
        totalComparisons,
        // Return the full ranked list for the result screen
        rankedList: allEntries
          .map(e => ({
            hardcoverBookId: e.hardcoverBookId,
            displayScore: displayScores.get(e.hardcoverBookId) ?? null,
            bookTitle: e.bookTitle,
            bookAuthor: e.bookAuthor,
            bookCoverUrl: e.bookCoverUrl,
          }))
          .sort((a, b) => (b.displayScore ?? 0) - (a.displayScore ?? 0)),
      },
    })
  } catch (error) {
    console.error('Comparison error:', error)
    return NextResponse.json({ error: 'Failed to record comparison' }, { status: 500 })
  }
}
