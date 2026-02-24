/**
 * Shared types and utility functions used across components and API routes.
 * Canonical book/user-book types are exported from hardcover.ts (HardcoverBook, UserBook).
 * These types are for client-side search results and UI components.
 *
 * Note: This file is safe to import from both server and client components.
 */

/** Lightweight book type for search results (subset of HardcoverBook) */
export interface BookType {
  id: number
  title: string
  slug: string
  cached_image?: { url: string } | null
  cached_contributors?: { author: { name: string; slug?: string } }[]
  pages?: number
  release_date?: string
}

/** A recommendation surfaced in search results */
export interface RecommendedBook {
  id: string
  hardcoverBookId: string
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
  note: string | null
  fromUser: { id: string; name: string; avatarUrl: string | null }
}

/** Search API response shape */
export interface SearchResult {
  myBooks: Array<{
    id: number
    status_id: number
    rating: number | null
    book: BookType
  }>
  recommendedBooks: RecommendedBook[]
  hardcoverResults: BookType[]
  authorBookResults: BookType[]
  networkBooks: Array<{
    book: BookType
    member: { id: string; name: string }
    statusLabel: string
  }>
  matchedUsers: Array<{
    id: string
    name: string
    avatarUrl: string | null
  }>
}

/** Get book cover URL, with placeholder fallback */
export function getBookCover(book: { cached_image?: { url: string } | null }): string {
  return book.cached_image?.url || '/book-placeholder.svg'
}

/** Get primary author name from book contributors */
export function getAuthor(book: { cached_contributors?: { author: { name: string } }[] }): string {
  return book.cached_contributors?.[0]?.author?.name || 'Unknown Author'
}
