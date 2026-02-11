const HARDCOVER_API_URL = process.env.HARDCOVER_API_URL || 'https://api.hardcover.app/v1/graphql'

export interface HardcoverBook {
  id: number
  title: string
  slug: string
  image?: {
    url: string
  }
  cached_image?: string
  description?: string
  release_date?: string
  cached_contributors?: { author: { name: string; slug: string } }[]
  pages?: number
  isbn_13?: string
  isbn_10?: string
}

export interface UserBookRead {
  progress: number | null
  progress_pages: number | null
  started_at: string | null
}

export interface UserBook {
  id: number
  status_id: number
  rating: number | null
  review?: string
  date_added?: string
  started_at?: string
  finished_at?: string
  book: HardcoverBook
  user_book_reads?: UserBookRead[]
}

async function hardcoverQuery(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(HARDCOVER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 }, // Cache for 5 minutes
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Hardcover API error: ${res.status} - ${text}`)
  }

  const json = await res.json()
  if (json.errors) {
    throw new Error(`Hardcover GraphQL error: ${JSON.stringify(json.errors)}`)
  }

  return json.data
}

export async function fetchUserProfile(token: string) {
  const query = `{
    me {
      id
      username
      name
      image { url }
      account_privacy_setting_id
    }
  }`
  const data = await hardcoverQuery(token, query)
  return data?.me?.[0] || null
}

export async function fetchCurrentlyReading(token: string) {
  const query = `{
    me {
      user_books(where: {status_id: {_eq: 2}}, order_by: {updated_at: desc}) {
        id
        status_id
        rating
        started_at
        book {
          id
          title
          slug
          cached_image
          description
          cached_contributors
          pages
          isbn_13
          isbn_10
        }
        user_book_reads(order_by: {started_at: desc_nulls_last}, limit: 1) {
          progress
          progress_pages
          started_at
        }
      }
    }
  }`
  const data = await hardcoverQuery(token, query)
  return data?.me?.[0]?.user_books || []
}

export async function fetchFinishedBooks(token: string, limit = 20) {
  const query = `{
    me {
      user_books(
        where: {status_id: {_eq: 3}},
        order_by: {finished_at: desc_nulls_last},
        limit: ${limit}
      ) {
        id
        status_id
        rating
        review
        started_at
        finished_at
        book {
          id
          title
          slug
          cached_image
          description
          cached_contributors
          pages
          isbn_13
          isbn_10
        }
      }
    }
  }`
  const data = await hardcoverQuery(token, query)
  return data?.me?.[0]?.user_books || []
}

export async function fetchWantToRead(token: string) {
  const query = `{
    me {
      user_books(where: {status_id: {_eq: 1}}, order_by: {updated_at: desc}) {
        id
        status_id
        book {
          id
          title
          slug
          cached_image
          description
          cached_contributors
          pages
          isbn_13
          isbn_10
        }
      }
    }
  }`
  const data = await hardcoverQuery(token, query)
  return data?.me?.[0]?.user_books || []
}

export async function fetchBookById(token: string, bookId: number) {
  const query = `{
    books(where: {id: {_eq: ${bookId}}}) {
      id
      title
      slug
      cached_image
      description
      release_date
      cached_contributors
      pages
      isbn_13
      isbn_10
    }
  }`
  const data = await hardcoverQuery(token, query)
  return data?.books?.[0] || null
}

export async function searchBooks(token: string, searchQuery: string) {
  const query = `{
    books(where: {title: {_ilike: "%${searchQuery.replace(/"/g, '\\"')}%"}}, limit: 10) {
      id
      title
      slug
      cached_image
      description
      cached_contributors
      pages
      isbn_13
      isbn_10
    }
  }`
  const data = await hardcoverQuery(token, query)
  return data?.books || []
}

export function getBookCoverUrl(book: HardcoverBook): string {
  if (book.cached_image) return book.cached_image
  if (book.image?.url) return book.image.url
  if (book.isbn_13) return `https://covers.openlibrary.org/b/isbn/${book.isbn_13}-L.jpg`
  if (book.isbn_10) return `https://covers.openlibrary.org/b/isbn/${book.isbn_10}-L.jpg`
  return '/book-placeholder.svg'
}

export function getAuthorName(book: HardcoverBook): string {
  if (book.cached_contributors && book.cached_contributors.length > 0) {
    return book.cached_contributors[0].author.name
  }
  return 'Unknown Author'
}

export function getLibbySearchUrl(title: string, author: string): string {
  const searchTerms = `title:${title} author:${author}`
  return `https://libbyapp.com/search/${encodeURIComponent(searchTerms)}`
}

export function getHardcoverBookUrl(slug: string): string {
  return `https://hardcover.app/books/${slug}`
}
