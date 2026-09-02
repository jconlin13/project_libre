import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isHardcoverId } from '@/lib/book-id'
import { migrateBookId } from '@/lib/book-merge'
import { cleanTitle, authorsOverlap } from '@/lib/cover-lookup'

export const dynamic = 'force-dynamic'

/**
 * Fold imported books into the Hardcover copy of the same book.
 *
 * ISBN resolution handles most of this, but a book with no ISBN in the export,
 * or one Hardcover doesn't carry under that ISBN, keeps its local id and ends
 * up sitting next to the Hardcover record of the same book — the library shows
 * "A Gentleman in Moscow" twice.
 *
 * Matching is on title and author rather than identifiers, because that's all
 * these leftovers have. Both must agree: subtitles are stripped before
 * comparison, which collapses "System Error: Where Big Tech Went Wrong" to
 * "System Error" and would otherwise collide with an unrelated book of that
 * name. Author agreement is what keeps them apart.
 */
function titleKey(title: string | null): string {
  if (!title) return ''
  return cleanTitle(title).toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const all = await prisma.snapshot.findMany({
      where: { userId: user.id },
      select: { hardcoverBookId: true, bookTitle: true, bookAuthor: true, bookCoverUrl: true },
    })

    const hardcoverRows = all.filter(s => isHardcoverId(s.hardcoverBookId))
    const importedRows = all.filter(s => !isHardcoverId(s.hardcoverBookId))

    // Index the Hardcover side by normalized title; several books can share one
    // title, so candidates are disambiguated by author below.
    const byTitle = new Map<string, typeof hardcoverRows>()
    for (const row of hardcoverRows) {
      const key = titleKey(row.bookTitle)
      if (!key) continue
      const list = byTitle.get(key) || []
      list.push(row)
      byTitle.set(key, list)
    }

    let merged = 0
    const examples: string[] = []

    for (const imported of importedRows) {
      const key = titleKey(imported.bookTitle)
      if (!key) continue

      const candidates = byTitle.get(key)
      if (!candidates?.length) continue

      // Require the author to agree. Without an author on either side we can't
      // be confident enough to merge — leaving a duplicate is recoverable,
      // merging two different books is not.
      const match = candidates.find(c =>
        imported.bookAuthor && c.bookAuthor && authorsOverlap(imported.bookAuthor, [c.bookAuthor])
      )
      if (!match) continue

      try {
        await migrateBookId(user.id, imported.hardcoverBookId, match.hardcoverBookId, {
          title: match.bookTitle || imported.bookTitle || 'Untitled',
          author: match.bookAuthor || imported.bookAuthor,
          coverUrl: match.bookCoverUrl || imported.bookCoverUrl,
        })
        merged++
        if (examples.length < 5 && imported.bookTitle) examples.push(imported.bookTitle)
      } catch (err) {
        console.error(`Dedupe failed for ${imported.hardcoverBookId}:`, err)
      }
    }

    const remainingLocal = await prisma.snapshot.count({
      where: {
        userId: user.id,
        OR: [
          { hardcoverBookId: { startsWith: 'isbn:' } },
          { hardcoverBookId: { startsWith: 'gr:' } },
        ],
      },
    })

    return NextResponse.json({ data: { merged, remainingLocal, examples } })
  } catch (error) {
    console.error('Dedupe error:', error)
    return NextResponse.json({ error: 'Dedupe failed' }, { status: 500 })
  }
}
