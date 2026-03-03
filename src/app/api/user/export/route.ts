import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [recommendations, plusOnes, rankings, comparisons, articles, articleSaves, snapshots, mediaTypes] = await Promise.all([
      prisma.recommendation.findMany({
        where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] },
        include: {
          fromUser: { select: { name: true, email: true } },
          toUser: { select: { name: true, email: true } },
        },
      }),
      prisma.plusOne.findMany({ where: { userId: user.id } }),
      prisma.bookRanking.findMany({ where: { userId: user.id } }),
      prisma.bookComparison.findMany({ where: { userId: user.id } }),
      prisma.article.findMany({ where: { userId: user.id } }),
      prisma.articleSave.findMany({
        where: { userId: user.id },
        include: { article: { select: { title: true, url: true } } },
      }),
      prisma.snapshot.findMany({ where: { userId: user.id } }),
      prisma.userBookMediaType.findMany({ where: { userId: user.id } }),
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: { name: user.name, email: user.email },
      recommendations: recommendations.map(r => ({
        bookTitle: r.bookTitle,
        bookAuthor: r.bookAuthor,
        note: r.note,
        status: r.status,
        from: r.fromUser.name,
        to: r.toUser.name,
        createdAt: r.createdAt,
      })),
      wishlist: plusOnes.map(p => ({
        bookTitle: p.bookTitle,
        bookAuthor: p.bookAuthor,
        createdAt: p.createdAt,
      })),
      rankings: rankings.map(r => ({
        bookTitle: r.bookTitle,
        bookAuthor: r.bookAuthor,
        eloScore: r.eloScore,
        manualOverride: r.manualOverride,
        comparisonCount: r.comparisonCount,
      })),
      comparisons: comparisons.map(c => ({
        winnerBookId: c.winnerBookId,
        loserBookId: c.loserBookId,
        isDraw: c.isDraw,
        createdAt: c.createdAt,
      })),
      articles: articles.map(a => ({
        title: a.title,
        url: a.url,
        description: a.description,
        source: a.source,
        tags: a.tags,
        note: a.note,
        createdAt: a.createdAt,
      })),
      savedArticles: articleSaves.map(s => ({
        articleTitle: s.article.title,
        articleUrl: s.article.url,
        savedAt: s.createdAt,
      })),
      readingSnapshots: snapshots.map(s => ({
        bookTitle: s.bookTitle,
        bookAuthor: s.bookAuthor,
        statusId: s.statusId,
        rating: s.rating,
        progressPct: s.progressPct,
      })),
      mediaTypes: mediaTypes.map(m => ({
        hardcoverBookId: m.hardcoverBookId,
        mediaType: m.mediaType,
      })),
    }

    const filename = `book-club-export-${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Data export error:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}
