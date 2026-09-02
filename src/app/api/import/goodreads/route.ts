import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { coverUrlFor } from '@/lib/book-id'
import { BUCKET_ELO, INITIAL_ELO } from '@/lib/ranking'
import type { ParsedBook } from '@/lib/goodreads-csv'

export const dynamic = 'force-dynamic'

const MAX_BOOKS = 5000

/**
 * Goodreads stars map onto the same impression buckets the in-app rating flow
 * uses, so imported books enter the Elo pool at sensible positions and refine
 * naturally once the user starts comparing.
 */
function eloFromStars(stars: number): number {
  if (stars >= 5) return BUCKET_ELO.loved
  if (stars >= 4) return BUCKET_ELO.liked
  if (stars >= 3) return BUCKET_ELO.okay
  if (stars >= 1) return BUCKET_ELO.disliked
  return INITIAL_ELO
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const books = body?.books as ParsedBook[] | undefined

    if (!Array.isArray(books) || books.length === 0) {
      return NextResponse.json({ error: 'No books to import' }, { status: 400 })
    }
    if (books.length > MAX_BOOKS) {
      return NextResponse.json(
        { error: `That file has ${books.length} books; the limit is ${MAX_BOOKS}.` },
        { status: 400 }
      )
    }

    // What the user already has, so we can report new vs updated honestly
    const existing = await prisma.snapshot.findMany({
      where: { userId: user.id },
      select: { hardcoverBookId: true },
    })
    const existingIds = new Set(existing.map(s => s.hardcoverBookId))

    let imported = 0
    let updated = 0
    let ranked = 0
    const failures: string[] = []

    for (const book of books) {
      if (!book?.bookId || !book?.title) continue

      const isUpdate = existingIds.has(book.bookId)
      const coverUrl = coverUrlFor(book.bookId)
      const lastReadDate = book.dateRead ? new Date(book.dateRead) : null
      const dateAdded = book.dateAdded ? new Date(book.dateAdded) : null

      try {
        await prisma.snapshot.upsert({
          where: {
            userId_hardcoverBookId: { userId: user.id, hardcoverBookId: book.bookId },
          },
          create: {
            userId: user.id,
            type: 'user_book',
            hardcoverBookId: book.bookId,
            statusId: book.statusId,
            rating: book.rating,
            bookTitle: book.title,
            bookAuthor: book.author,
            bookCoverUrl: coverUrl,
            lastReadDate,
            dateAdded,
            // An import is a deliberate statement of where these books sit,
            // and is newer than whatever Hardcover last reported.
            localUpdatedAt: new Date(),
          },
          update: {
            statusId: book.statusId,
            rating: book.rating,
            bookTitle: book.title,
            bookAuthor: book.author,
            // Don't blank an existing cover if Open Library has nothing for us
            ...(coverUrl ? { bookCoverUrl: coverUrl } : {}),
            ...(lastReadDate ? { lastReadDate } : {}),
            ...(dateAdded ? { dateAdded } : {}),
            localUpdatedAt: new Date(),
            updatedAt: new Date(),
          },
        })

        // Seed the ranking pool from stars, but never clobber a score the user
        // has already refined here through comparisons or a manual override.
        if (book.rating != null && book.statusId === 3) {
          const existingRanking = await prisma.bookRanking.findUnique({
            where: {
              userId_hardcoverBookId: { userId: user.id, hardcoverBookId: book.bookId },
            },
            select: { comparisonCount: true, manualOverride: true },
          })

          const untouched =
            !existingRanking ||
            (existingRanking.comparisonCount === 0 && existingRanking.manualOverride === null)

          if (untouched) {
            await prisma.bookRanking.upsert({
              where: {
                userId_hardcoverBookId: { userId: user.id, hardcoverBookId: book.bookId },
              },
              create: {
                userId: user.id,
                hardcoverBookId: book.bookId,
                eloScore: eloFromStars(book.rating),
                comparisonCount: 0,
                bookTitle: book.title,
                bookAuthor: book.author,
                bookCoverUrl: coverUrl,
              },
              update: {
                eloScore: eloFromStars(book.rating),
                bookTitle: book.title,
                bookAuthor: book.author,
              },
            })
            ranked++
          }
        }

        if (isUpdate) updated++
        else imported++
      } catch (err) {
        console.error(`Import failed for "${book.title}":`, err)
        failures.push(book.title)
      }
    }

    await logAudit({
      userId: user.id,
      action: 'library_import',
      details: { source: 'goodreads', imported, updated, ranked, failed: failures.length },
    })

    return NextResponse.json({
      data: { imported, updated, ranked, failed: failures.length, failures: failures.slice(0, 5) },
    })
  } catch (error) {
    console.error('Goodreads import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
