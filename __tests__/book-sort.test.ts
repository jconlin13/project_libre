import { sortBooks, authorSortKey, SORT_OPTIONS, type SortableBook } from '@/lib/book-sort'

function book(overrides: Partial<SortableBook> & { bookTitle: string }): SortableBook {
  return {
    bookAuthor: null,
    rating: null,
    progressPct: null,
    lastReadDate: null,
    dateAdded: null,
    ...overrides,
  }
}

const titles = (books: SortableBook[]) => books.map(b => b.bookTitle)

describe('authorSortKey', () => {
  it('files an author under their surname', () => {
    expect(authorSortKey('Gabrielle Zevin')).toBe('zevin')
    expect(authorSortKey('Jon Meacham')).toBe('meacham')
  })

  it('handles a single name and extra whitespace', () => {
    expect(authorSortKey('Homer')).toBe('homer')
    expect(authorSortKey('  Abraham   Verghese ')).toBe('verghese')
  })

  it('returns an empty key for a missing author', () => {
    expect(authorSortKey(null)).toBe('')
  })
})

describe('sorting by title', () => {
  const books = [book({ bookTitle: 'Trust' }), book({ bookTitle: 'Absalom' }), book({ bookTitle: 'Martyr!' })]

  it('sorts A–Z ascending and Z–A descending', () => {
    expect(titles(sortBooks(books, 'title', 'asc'))).toEqual(['Absalom', 'Martyr!', 'Trust'])
    expect(titles(sortBooks(books, 'title', 'desc'))).toEqual(['Trust', 'Martyr!', 'Absalom'])
  })

  it('does not mutate the input array', () => {
    const original = [...titles(books)]
    sortBooks(books, 'title', 'desc')
    expect(titles(books)).toEqual(original)
  })
})

describe('sorting by author', () => {
  it('orders by surname, not first name', () => {
    const books = [
      book({ bookTitle: 'A', bookAuthor: 'Gabrielle Zevin' }),
      book({ bookTitle: 'B', bookAuthor: 'Jon Meacham' }),
      book({ bookTitle: 'C', bookAuthor: 'Amor Towles' }),
    ]
    expect(titles(sortBooks(books, 'author', 'asc'))).toEqual(['B', 'C', 'A'])
  })

  it('falls back to title order within one author', () => {
    const books = [
      book({ bookTitle: 'Rules of Civility', bookAuthor: 'Amor Towles' }),
      book({ bookTitle: 'A Gentleman in Moscow', bookAuthor: 'Amor Towles' }),
    ]
    expect(titles(sortBooks(books, 'author', 'asc'))).toEqual([
      'A Gentleman in Moscow',
      'Rules of Civility',
    ])
  })
})

describe('sorting by rating', () => {
  const books = [
    book({ bookTitle: 'Three', rating: 3 }),
    book({ bookTitle: 'Unrated' }),
    book({ bookTitle: 'Five', rating: 5 }),
  ]

  it('puts the highest rating first when descending', () => {
    expect(titles(sortBooks(books, 'rating', 'desc'))).toEqual(['Five', 'Three', 'Unrated'])
  })

  it('keeps unrated books last even when ascending', () => {
    // Flipping direction should not promote a book that has no rating at all
    expect(titles(sortBooks(books, 'rating', 'asc'))).toEqual(['Three', 'Five', 'Unrated'])
  })
})

describe('sorting by date', () => {
  const books = [
    book({ bookTitle: 'Middle', dateAdded: '2026-05-01T00:00:00.000Z' }),
    book({ bookTitle: 'Undated' }),
    book({ bookTitle: 'Newest', dateAdded: '2026-08-31T00:00:00.000Z' }),
    book({ bookTitle: 'Oldest', dateAdded: '2024-01-15T00:00:00.000Z' }),
  ]

  it('sorts newest first descending, oldest first ascending', () => {
    expect(titles(sortBooks(books, 'dateAdded', 'desc'))).toEqual(['Newest', 'Middle', 'Oldest', 'Undated'])
    expect(titles(sortBooks(books, 'dateAdded', 'asc'))).toEqual(['Oldest', 'Middle', 'Newest', 'Undated'])
  })

  it('sorts date completed off lastReadDate', () => {
    const read = [
      book({ bookTitle: 'Later', lastReadDate: '2026-06-01T00:00:00.000Z' }),
      book({ bookTitle: 'Earlier', lastReadDate: '2026-02-01T00:00:00.000Z' }),
    ]
    expect(titles(sortBooks(read, 'dateCompleted', 'desc'))).toEqual(['Later', 'Earlier'])
  })
})

describe('sorting by progress', () => {
  it('orders by percent complete, unstarted last', () => {
    const books = [
      book({ bookTitle: 'Half', progressPct: 50 }),
      book({ bookTitle: 'Unknown' }),
      book({ bookTitle: 'Nearly', progressPct: 90 }),
    ]
    expect(titles(sortBooks(books, 'progress', 'desc'))).toEqual(['Nearly', 'Half', 'Unknown'])
  })
})

describe('shelf-specific options', () => {
  it('offers date completed only on finished shelves', () => {
    const forShelf = (shelf: string) =>
      SORT_OPTIONS.filter(o => !o.shelves || o.shelves.includes(shelf)).map(o => o.key)

    expect(forShelf('read')).toContain('dateCompleted')
    expect(forShelf('want-to-read')).not.toContain('dateCompleted')
  })

  it('offers progress only while currently reading', () => {
    const forShelf = (shelf: string) =>
      SORT_OPTIONS.filter(o => !o.shelves || o.shelves.includes(shelf)).map(o => o.key)

    expect(forShelf('currently-reading')).toContain('progress')
    expect(forShelf('read')).not.toContain('progress')
  })

  it('always offers title, author, rating and date added', () => {
    for (const shelf of ['currently-reading', 'read', 'want-to-read', 'not-finished']) {
      const keys = SORT_OPTIONS.filter(o => !o.shelves || o.shelves.includes(shelf)).map(o => o.key)
      expect(keys).toEqual(expect.arrayContaining(['title', 'author', 'rating', 'dateAdded']))
    }
  })
})
