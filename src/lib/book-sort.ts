/**
 * Sorting for the My Books shelves. Pure functions so the ordering rules can
 * be tested directly rather than through the UI.
 */

export type SortKey = 'dateAdded' | 'title' | 'author' | 'rating' | 'dateCompleted' | 'progress'
export type SortDir = 'asc' | 'desc'

export interface SortableBook {
  bookTitle: string | null
  bookAuthor: string | null
  rating: number | null
  progressPct: number | null
  lastReadDate: string | null
  dateAdded: string | null
}

export interface SortOption {
  key: SortKey
  label: string
  /** Direction wording differs by data type — "A–Z" vs "Oldest first". */
  asc: string
  desc: string
  /** Shelves this sort is meaningful on; omitted means all of them. */
  shelves?: string[]
}

export const SORT_OPTIONS: SortOption[] = [
  { key: 'dateAdded', label: 'Date added', asc: 'Oldest first', desc: 'Newest first' },
  { key: 'title', label: 'Title', asc: 'A–Z', desc: 'Z–A' },
  { key: 'author', label: 'Author', asc: 'A–Z', desc: 'Z–A' },
  { key: 'rating', label: 'Rating', asc: 'Lowest first', desc: 'Highest first' },
  {
    key: 'dateCompleted',
    label: 'Date completed',
    asc: 'Oldest first',
    desc: 'Newest first',
    shelves: ['read', 'not-finished'],
  },
  {
    key: 'progress',
    label: 'Progress',
    asc: 'Least first',
    desc: 'Most first',
    shelves: ['currently-reading'],
  },
]

/** Surname, so "Gabrielle Zevin" files under Z the way a shelf would. */
export function authorSortKey(author: string | null): string {
  const parts = (author || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

const isMissing = (v: unknown) => v == null || v === ''

/**
 * Compare two books on one field.
 *
 * Books missing the sort field always sort last regardless of direction — an
 * unrated book shouldn't lead the list just because you flipped to ascending.
 */
export function compareBooks(
  a: SortableBook,
  b: SortableBook,
  key: SortKey,
  dir: SortDir
): number {
  const flip = dir === 'asc' ? 1 : -1
  const text = (v: string | null) => (v || '').trim().toLowerCase()

  switch (key) {
    case 'title':
      return text(a.bookTitle).localeCompare(text(b.bookTitle)) * flip

    case 'author': {
      const cmp = authorSortKey(a.bookAuthor).localeCompare(authorSortKey(b.bookAuthor))
      // Same author: keep their books in title order
      return (cmp !== 0 ? cmp : text(a.bookTitle).localeCompare(text(b.bookTitle))) * flip
    }

    case 'rating':
    case 'progress': {
      const field = key === 'rating' ? 'rating' : 'progressPct'
      const av = a[field]
      const bv = b[field]
      if (isMissing(av) && isMissing(bv)) return 0
      if (isMissing(av)) return 1
      if (isMissing(bv)) return -1
      return ((av as number) - (bv as number)) * flip
    }

    case 'dateAdded':
    case 'dateCompleted': {
      const field = key === 'dateAdded' ? 'dateAdded' : 'lastReadDate'
      const av = a[field]
      const bv = b[field]
      if (isMissing(av) && isMissing(bv)) return 0
      if (isMissing(av)) return 1
      if (isMissing(bv)) return -1
      return (new Date(av as string).getTime() - new Date(bv as string).getTime()) * flip
    }
  }
}

export function sortBooks<T extends SortableBook>(books: T[], key: SortKey, dir: SortDir): T[] {
  return [...books].sort((a, b) => compareBooks(a, b, key, dir))
}
