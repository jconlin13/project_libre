/**
 * Parser for Goodreads library exports.
 *
 * Written by hand rather than pulling in a CSV dependency: the format is small
 * and stable, and the Goodreads-specific quirks (Excel-escaped ISBNs, ratings
 * of 0 meaning unrated) need handling regardless of which parser produces the
 * raw fields.
 */

import { isbnBookId, goodreadsBookId } from '@/lib/book-id'

// Goodreads' exclusive shelves map onto the app's Hardcover-derived status ids.
// 'did-not-finish' is a Goodreads default shelf and matches the app's DNF (5).
export const SHELF_TO_STATUS: Record<string, number> = {
  'to-read': 1,
  'currently-reading': 2,
  'read': 3,
  'did-not-finish': 5,
}

export interface ParsedBook {
  bookId: string
  title: string
  author: string | null
  isbn: string | null
  /** 1-5, or null when Goodreads recorded no rating (exported as 0). */
  rating: number | null
  statusId: number
  shelf: string
  dateRead: string | null
  dateAdded: string | null
  pageCount: number | null
}

export interface ParseResult {
  books: ParsedBook[]
  /** Rows we could not use, with the reason — surfaced in the preview. */
  skipped: Array<{ row: number; reason: string }>
}

/**
 * Split CSV text into rows of fields, honoring quoted fields that contain
 * commas, escaped double-quotes ("") and newlines inside quotes.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  // Normalize line endings so \r\n doesn't leak into the last field of a row
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const char = src[i]

    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      // Skip blank lines
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  // Trailing field/row when the file doesn't end in a newline
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.length > 1 || row[0] !== '') rows.push(row)
  }

  return rows
}

/**
 * Goodreads writes ISBNs as Excel formulas so spreadsheet apps don't mangle
 * leading zeros: ="0374619239". Empty values come through as ="".
 */
export function cleanIsbn(raw: string | undefined): string | null {
  if (!raw) return null
  const stripped = raw.replace(/^="?/, '').replace(/"?$/, '').trim()
  if (!stripped) return null
  // ISBN-10 may end in X; anything else non-numeric is junk
  if (!/^[0-9]{9,13}[0-9X]?$/i.test(stripped)) return null
  return stripped
}

/** Goodreads dates are YYYY/MM/DD, and are often blank even for read books. */
export function parseGoodreadsDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const match = raw.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  if (isNaN(date.getTime())) return null
  return date.toISOString()
}

export function parseGoodreadsCsv(text: string): ParseResult {
  const rows = parseCsvRows(text)
  const books: ParsedBook[] = []
  const skipped: ParseResult['skipped'] = []

  if (rows.length === 0) {
    return { books, skipped: [{ row: 0, reason: 'File is empty' }] }
  }

  const header = rows[0].map(h => h.trim())
  const col = (name: string) => header.indexOf(name)

  const idxTitle = col('Title')
  const idxShelf = col('Exclusive Shelf')
  if (idxTitle === -1 || idxShelf === -1) {
    return {
      books,
      skipped: [{ row: 0, reason: 'Not a Goodreads export — missing Title or Exclusive Shelf column' }],
    }
  }

  const idxBookId = col('Book Id')
  const idxAuthor = col('Author')
  const idxIsbn13 = col('ISBN13')
  const idxIsbn = col('ISBN')
  const idxRating = col('My Rating')
  const idxDateRead = col('Date Read')
  const idxDateAdded = col('Date Added')
  const idxPages = col('Number of Pages')

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const title = row[idxTitle]?.trim()
    if (!title) {
      skipped.push({ row: i + 1, reason: 'No title' })
      continue
    }

    const shelf = row[idxShelf]?.trim() || ''
    const statusId = SHELF_TO_STATUS[shelf]
    if (!statusId) {
      skipped.push({ row: i + 1, reason: `Unrecognized shelf "${shelf || '(blank)'}"` })
      continue
    }

    const isbn = cleanIsbn(row[idxIsbn13]) || cleanIsbn(row[idxIsbn])
    const goodreadsId = row[idxBookId]?.trim()

    // Prefer ISBN so the same book imported from anywhere lands on one id
    let bookId: string
    if (isbn) bookId = isbnBookId(isbn)
    else if (goodreadsId) bookId = goodreadsBookId(goodreadsId)
    else {
      skipped.push({ row: i + 1, reason: 'No ISBN or Goodreads id' })
      continue
    }

    const ratingRaw = Number(row[idxRating] ?? 0)
    const rating = Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw : null

    const pagesRaw = Number(row[idxPages] ?? '')
    const pageCount = Number.isFinite(pagesRaw) && pagesRaw > 0 ? pagesRaw : null

    books.push({
      bookId,
      title,
      author: row[idxAuthor]?.trim() || null,
      isbn,
      rating,
      statusId,
      shelf,
      dateRead: parseGoodreadsDate(row[idxDateRead]),
      dateAdded: parseGoodreadsDate(row[idxDateAdded]),
      pageCount,
    })
  }

  return { books, skipped }
}

/** Counts for the pre-import preview. */
export function summarize(books: ParsedBook[]) {
  return {
    total: books.length,
    wantToRead: books.filter(b => b.statusId === 1).length,
    currentlyReading: books.filter(b => b.statusId === 2).length,
    read: books.filter(b => b.statusId === 3).length,
    didNotFinish: books.filter(b => b.statusId === 5).length,
    rated: books.filter(b => b.rating != null).length,
    withoutIsbn: books.filter(b => !b.isbn).length,
  }
}
