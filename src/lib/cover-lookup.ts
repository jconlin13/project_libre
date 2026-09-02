/**
 * Resolving cover art for imported books.
 *
 * Identity stays the ISBN (or Goodreads id) — this only fills in artwork.
 *
 * Open Library's cover-by-ISBN endpoint is exact but has gaps: roughly a
 * quarter of a real Goodreads library came back empty, and books exported
 * without an ISBN had nothing to look up at all. Its search API covers those,
 * but only once the title is cleaned: Goodreads titles carry series suffixes
 * and subtitles ("Red Rising (Red Rising Saga, #1)") that never match. With
 * cleaning, every book in a failing sample resolved.
 *
 * Everything here is keyless and needs no account — no per-user API token and
 * no shared service credential.
 */

const OL_SEARCH = 'https://openlibrary.org/search.json'
const OL_COVER_BY_ID = 'https://covers.openlibrary.org/b/id'
const OL_COVER_BY_ISBN = 'https://covers.openlibrary.org/b/isbn'

// Open Library asks that clients identify themselves.
const USER_AGENT = 'Libre/1.0 (private family book club; contact via github.com/jconlin13/project_libre)'

const TIMEOUT_MS = 12_000

/**
 * Strip the annotations Goodreads adds to titles, which prevent catalog
 * matches: trailing series markers and everything after a subtitle colon.
 */
export function cleanTitle(raw: string): string {
  let t = raw
  // "(Red Rising Saga, #1)" / "(The Cemetery of Forgotten Books, #1)"
  t = t.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, '')
  // "(The Expanse Series)" and similar without a number
  t = t.replace(/\s*\((?:The\s+)?[^)]*(?:Saga|Series|Trilogy|Duology|Cycle|Books?)[^)]*\)\s*$/i, '')
  // Subtitle after a colon — catalogs usually index the main title only
  const colon = t.indexOf(':')
  if (colon > 0) t = t.slice(0, colon)
  return t.trim()
}

export function coverUrlByIsbn(isbn: string): string {
  // default=false makes a missing cover 404 rather than a blank 43-byte image
  return `${OL_COVER_BY_ISBN}/${isbn}-L.jpg?default=false`
}

export function coverUrlByOpenLibraryId(coverId: number): string {
  return `${OL_COVER_BY_ID}/${coverId}-L.jpg`
}

async function fetchWithTimeout(url: string, method: 'GET' | 'HEAD' = 'GET'): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** True when Open Library actually has cover art for this ISBN. */
export async function hasCoverForIsbn(isbn: string): Promise<boolean> {
  const res = await fetchWithTimeout(coverUrlByIsbn(isbn), 'HEAD')
  return !!res?.ok
}

/** Lowercase, strip accents and punctuation, so "Zafón" matches "Zafon". */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
}

/** Surnames, for comparing an author across catalogs that format names differently. */
function surnamesOf(author: string): Set<string> {
  const parts = normalizeName(author).split(/\s+/).filter(Boolean)
  // Compare against every token, since catalogs vary on middle names,
  // initials and suffixes — a shared surname token is the reliable signal.
  return new Set(parts.filter(p => p.length > 2))
}

export function authorsOverlap(ours: string, theirs: string[]): boolean {
  const mine = surnamesOf(ours)
  if (mine.size === 0) return false
  return theirs.some(t => {
    const tokens = surnamesOf(t)
    for (const token of tokens) if (mine.has(token)) return true
    return false
  })
}

/**
 * @param requireAuthorMatch when the author isn't passed to the API as a
 *   filter, verify it against the results instead. Without this a cleaned
 *   title can match an unrelated book — "Lion Hearts" returned Poul Anderson's
 *   "Three Hearts and Three Lions" rather than Dan Jones's novel.
 */
async function searchCoverId(
  title: string,
  author: string | null,
  requireAuthorMatch: string | null = null
): Promise<number | null> {
  const params = new URLSearchParams({ title, limit: '5', fields: 'title,author_name,cover_i' })
  if (author) params.set('author', author)

  const res = await fetchWithTimeout(`${OL_SEARCH}?${params.toString()}`)
  if (!res?.ok) return null

  try {
    const data = (await res.json()) as {
      docs?: Array<{ cover_i?: number; author_name?: string[] }>
    }
    for (const doc of data.docs || []) {
      if (!doc.cover_i) continue
      if (requireAuthorMatch && !authorsOverlap(requireAuthorMatch, doc.author_name || [])) {
        continue
      }
      return doc.cover_i
    }
  } catch {
    // Malformed response — treat as no result
  }
  return null
}

export interface CoverResult {
  url: string | null
  /** Which step produced it, for reporting what enrichment actually did. */
  via: 'isbn' | 'search-with-author' | 'search-title-only' | null
}

/**
 * Find cover art, cheapest lookup first.
 *
 * The title-only retry matters more than it looks: author spellings differ
 * between Goodreads and Open Library (accents, initials, "Jr."), and an author
 * mismatch suppresses an otherwise correct match.
 */
export async function resolveCover(
  title: string,
  author: string | null,
  isbn: string | null
): Promise<CoverResult> {
  if (isbn && (await hasCoverForIsbn(isbn))) {
    return { url: coverUrlByIsbn(isbn), via: 'isbn' }
  }

  const cleaned = cleanTitle(title)
  if (!cleaned) return { url: null, via: null }

  if (author) {
    const withAuthor = await searchCoverId(cleaned, author)
    if (withAuthor) return { url: coverUrlByOpenLibraryId(withAuthor), via: 'search-with-author' }
  }

  // Retry without the author filter — spellings differ between catalogs
  // (accents, initials, suffixes) and a mismatch suppresses a correct hit.
  // When we do know the author, still require it to match one of the results,
  // or a common title will pull in an unrelated book.
  const titleOnly = await searchCoverId(cleaned, null, author)
  if (titleOnly) return { url: coverUrlByOpenLibraryId(titleOnly), via: 'search-title-only' }

  return { url: null, via: null }
}
