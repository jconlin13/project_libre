/**
 * Book identity across sources.
 *
 * Books originally came only from Hardcover, so the id column everywhere is
 * `hardcoverBookId` and holds a bare numeric Hardcover id. Imported libraries
 * have no Hardcover id, so they reuse the same column with a namespace prefix:
 *
 *   1011167              → Hardcover book 1011167
 *   isbn:9780374619237   → identified by ISBN (preferred for imports)
 *   gr:231127175         → Goodreads id, when a row has no usable ISBN
 *
 * Keeping one column avoids a migration across Snapshot, BookRanking,
 * Recommendation, ActivityEvent and PlusOne; this module is the only place
 * that needs to know the convention.
 */

export type BookSource = 'hardcover' | 'isbn' | 'goodreads'

export interface ParsedBookId {
  source: BookSource
  value: string
  /** The full namespaced id as stored. */
  raw: string
}

export function parseBookId(raw: string): ParsedBookId {
  if (raw.startsWith('isbn:')) {
    return { source: 'isbn', value: raw.slice(5), raw }
  }
  if (raw.startsWith('gr:')) {
    return { source: 'goodreads', value: raw.slice(3), raw }
  }
  return { source: 'hardcover', value: raw, raw }
}

export function isHardcoverId(raw: string): boolean {
  return parseBookId(raw).source === 'hardcover'
}

export function isbnBookId(isbn: string): string {
  return `isbn:${isbn}`
}

export function goodreadsBookId(id: string): string {
  return `gr:${id}`
}

/**
 * Cover image for an imported book. Open Library serves covers by ISBN with no
 * auth; `covers.openlibrary.org` is already allowlisted in next.config.ts.
 * Returns null when we have no ISBN to look up.
 *
 * `default=false` matters: without it Open Library answers 200 with a 43-byte
 * blank image for books it has no cover for, which renders as an empty box and
 * never fires an error handler. With it, missing covers 404 so the UI can fall
 * back to a title card.
 */
export function coverUrlFor(bookId: string): string | null {
  const parsed = parseBookId(bookId)
  if (parsed.source !== 'isbn') return null
  return `https://covers.openlibrary.org/b/isbn/${parsed.value}-L.jpg?default=false`
}

/** Public Open Library page, used as the "more info" target for imported books. */
export function openLibraryUrlFor(bookId: string): string | null {
  const parsed = parseBookId(bookId)
  if (parsed.source !== 'isbn') return null
  return `https://openlibrary.org/isbn/${parsed.value}`
}
