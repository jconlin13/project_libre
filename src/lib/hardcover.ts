const HARDCOVER_API_URL = process.env.HARDCOVER_API_URL || 'https://api.hardcover.app/v1/graphql'

export interface HardcoverBook {
  id: number
  title: string
  slug: string
  cached_image?: { url: string } | null
  description?: string
  release_date?: string
  cached_contributors?: { author: { name: string; slug: string } }[]
  pages?: number
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
  book: HardcoverBook
  user_book_reads?: UserBookRead[]
}

// Shared book fields fragment used across all queries
const BOOK_FIELDS = `
  id
  title
  slug
  cached_image
  description
  cached_contributors
  pages
  release_date
`

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
        date_added
        book {
          ${BOOK_FIELDS}
        }
        user_book_reads(order_by: {started_at: desc_nulls_last}, limit: 1) {
          id
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
        order_by: {last_read_date: desc_nulls_last},
        limit: ${limit}
      ) {
        id
        status_id
        rating
        review
        last_read_date
        book {
          ${BOOK_FIELDS}
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
        rating
        date_added
        book {
          ${BOOK_FIELDS}
        }
      }
    }
  }`
  const data = await hardcoverQuery(token, query)
  return data?.me?.[0]?.user_books || []
}

export async function fetchDidNotFinish(token: string) {
  const query = `{
    me {
      user_books(where: {status_id: {_eq: 5}}, order_by: {updated_at: desc}) {
        id
        status_id
        rating
        date_added
        book {
          ${BOOK_FIELDS}
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
      ${BOOK_FIELDS}
    }
  }`
  const data = await hardcoverQuery(token, query)
  return data?.books?.[0] || null
}

export async function fetchAllUserBooks(token: string) {
  const query = `{
    me {
      user_books(order_by: {updated_at: desc}) {
        id
        status_id
        rating
        date_added
        book {
          ${BOOK_FIELDS}
        }
        user_book_reads(order_by: {started_at: desc_nulls_last}, limit: 1) {
          id
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

export async function addBookToWantToRead(token: string, bookId: number) {
  const mutation = `
    mutation InsertUserBook($book_id: Int!, $status_id: Int!) {
      insert_user_book(object: {book_id: $book_id, status_id: $status_id}) {
        id
        user_book {
          id
          status_id
          book {
            ${BOOK_FIELDS}
          }
        }
      }
    }
  `
  return await hardcoverQuery(token, mutation, { book_id: bookId, status_id: 1 })
}

export async function searchBooks(token: string, searchQuery: string, perPage = 10) {
  // Step 1: Get book IDs from Typesense search
  const searchQ = `
    query Search($q: String!) {
      search(query: $q, query_type: "books", per_page: ${perPage}, page: 1) {
        results
      }
    }
  `
  const searchData = await hardcoverQuery(token, searchQ, { q: searchQuery })
  const hits = searchData?.search?.results?.hits || []
  if (hits.length === 0) return []

  // Step 2: Batch-fetch full book data with cached_image from GraphQL
  const bookIds = hits.map((hit: any) => hit.document.id)
  const booksQuery = `{
    books(where: {id: {_in: [${bookIds.join(',')}]}}) {
      ${BOOK_FIELDS}
    }
  }`
  const booksData = await hardcoverQuery(token, booksQuery)
  return booksData?.books || []
}

export async function searchByAuthor(token: string, searchQuery: string, perPage = 5) {
  // Step 1: Search for authors via Typesense
  const searchQ = `
    query Search($q: String!) {
      search(query: $q, query_type: "authors", per_page: ${perPage}, page: 1) {
        results
      }
    }
  `
  const searchData = await hardcoverQuery(token, searchQ, { q: searchQuery })
  const hits = searchData?.search?.results?.hits || []
  if (hits.length === 0) return []

  // Step 2: Fetch authors with their book contributions
  const authorIds = hits.map((hit: any) => hit.document.id)
  const authorsQuery = `{
    authors(where: {id: {_in: [${authorIds.join(',')}]}}) {
      id
      name
      slug
      cached_image
      books_count
      contributions(order_by: {book: {users_count: desc_nulls_last}}, limit: 20) {
        book {
          ${BOOK_FIELDS}
        }
      }
    }
  }`
  const authorsData = await hardcoverQuery(token, authorsQuery)
  const authors = authorsData?.authors || []

  // Flatten: extract unique books from all matched authors
  const seenBookIds = new Set<number>()
  const books: HardcoverBook[] = []
  for (const author of authors) {
    for (const contribution of author.contributions || []) {
      if (contribution.book && !seenBookIds.has(contribution.book.id)) {
        seenBookIds.add(contribution.book.id)
        books.push(contribution.book)
      }
    }
  }
  return books
}

export function getHardcoverAuthorUrl(slug: string): string {
  return `https://hardcover.app/authors/${slug}`
}

export async function updateBookRating(
  token: string,
  userBookId: number,
  rating: number
) {
  const mutation = `
    mutation UpdateUserBook($id: Int!, $object: UserBookUpdateInput!) {
      update_user_book(id: $id, object: $object) {
        id
        user_book {
          id
          rating
        }
      }
    }
  `
  return await hardcoverQuery(token, mutation, {
    id: userBookId,
    object: { rating: rating === 0 ? null : rating },
  })
}

export async function updateBookStatus(
  token: string,
  userBookId: number,
  statusId: number
) {
  const mutation = `
    mutation UpdateUserBook($id: Int!, $object: UserBookUpdateInput!) {
      update_user_book(id: $id, object: $object) {
        id
        user_book {
          id
          status_id
        }
      }
    }
  `
  return await hardcoverQuery(token, mutation, {
    id: userBookId,
    object: { status_id: statusId },
  })
}

export async function updateReadingProgress(
  token: string,
  userBookId: number,
  readId: number | null,
  progress?: number,
  progressPages?: number
) {
  if (readId) {
    // Update existing read
    const object: Record<string, unknown> = {}
    if (progress != null) object.progress = progress / 100 // API expects 0.0-1.0
    if (progressPages != null) object.progress_pages = progressPages

    const mutation = `
      mutation UpdateUserBookRead($id: Int!, $object: DatesReadInput!) {
        update_user_book_read(id: $id, object: $object) {
          id
          user_book_read {
            id
            progress
            progress_pages
          }
        }
      }
    `
    return await hardcoverQuery(token, mutation, { id: readId, object })
  } else {
    // Insert new read
    const userBookRead: Record<string, unknown> = {}
    if (progress != null) userBookRead.progress = progress / 100
    if (progressPages != null) userBookRead.progress_pages = progressPages
    userBookRead.started_at = new Date().toISOString().split('T')[0]

    const mutation = `
      mutation InsertUserBookRead($user_book_id: Int!, $user_book_read: DatesReadInput!) {
        insert_user_book_read(user_book_id: $user_book_id, user_book_read: $user_book_read) {
          id
          user_book_read {
            id
            progress
            progress_pages
          }
        }
      }
    `
    return await hardcoverQuery(token, mutation, { user_book_id: userBookId, user_book_read: userBookRead })
  }
}

export function getBookCoverUrl(book: HardcoverBook): string {
  if (book.cached_image?.url) return book.cached_image.url
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
