import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { hardcoverBookId, rating, bookTitle, bookAuthor, bookCoverUrl } = await request.json()

    if (!hardcoverBookId || rating == null) {
      return NextResponse.json({ error: 'hardcoverBookId and rating are required' }, { status: 400 })
    }

    const numRating = Number(rating)
    if (numRating < 0 || numRating > 5) {
      return NextResponse.json({ error: 'Rating must be between 0 and 5' }, { status: 400 })
    }

    // Round to nearest 0.1
    const roundedRating = Math.round(numRating * 10) / 10

    // Upsert ranking with manual override
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
        manualOverride: roundedRating === 0 ? null : roundedRating,
        bookTitle: bookTitle || null,
        bookAuthor: bookAuthor || null,
        bookCoverUrl: bookCoverUrl || null,
      },
      update: {
        manualOverride: roundedRating === 0 ? null : roundedRating,
        bookTitle: bookTitle || null,
        bookAuthor: bookAuthor || null,
        bookCoverUrl: bookCoverUrl || null,
      },
    })

    return NextResponse.json({
      data: {
        hardcoverBookId: ranking.hardcoverBookId,
        manualOverride: ranking.manualOverride,
        displayScore: ranking.manualOverride ?? null,
      },
    })
  } catch (error) {
    console.error('Manual rating error:', error)
    return NextResponse.json({ error: 'Failed to set manual rating' }, { status: 500 })
  }
}
