import {
  parseCsvRows,
  cleanIsbn,
  parseGoodreadsDate,
  parseGoodreadsCsv,
  summarize,
} from '@/lib/goodreads-csv'

const HEADER =
  'Book Id,Title,Author,ISBN,ISBN13,My Rating,Number of Pages,Date Read,Date Added,Exclusive Shelf'

function csv(...rows: string[]) {
  return [HEADER, ...rows].join('\n')
}

describe('parseCsvRows', () => {
  it('keeps commas that live inside quoted fields', () => {
    const rows = parseCsvRows('a,"Smith, John",c')
    expect(rows[0]).toEqual(['a', 'Smith, John', 'c'])
  })

  it('unescapes doubled quotes', () => {
    const rows = parseCsvRows('"He said ""hi""",x')
    expect(rows[0]).toEqual(['He said "hi"', 'x'])
  })

  it('handles CRLF line endings without trailing carriage returns', () => {
    const rows = parseCsvRows('a,b\r\nc,d')
    expect(rows).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('reads the final row when the file has no trailing newline', () => {
    const rows = parseCsvRows('a,b\nc,d')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual(['c', 'd'])
  })
})

describe('cleanIsbn', () => {
  it('strips the Excel formula wrapper Goodreads writes', () => {
    expect(cleanIsbn('="9780374619237"')).toBe('9780374619237')
  })

  it('treats an empty formula as no ISBN', () => {
    expect(cleanIsbn('=""')).toBeNull()
    expect(cleanIsbn('')).toBeNull()
    expect(cleanIsbn(undefined)).toBeNull()
  })

  it('accepts an ISBN-10 ending in X', () => {
    expect(cleanIsbn('="080213825X"')).toBe('080213825X')
  })

  it('rejects values that are not ISBN-shaped', () => {
    expect(cleanIsbn('="not-an-isbn"')).toBeNull()
  })
})

describe('parseGoodreadsDate', () => {
  it('parses the YYYY/MM/DD format', () => {
    const iso = parseGoodreadsDate('2026/08/31')
    expect(iso).not.toBeNull()
    const d = new Date(iso!)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7) // zero-indexed August
    expect(d.getDate()).toBe(31)
  })

  it('returns null for blank or malformed dates', () => {
    expect(parseGoodreadsDate('')).toBeNull()
    expect(parseGoodreadsDate(undefined)).toBeNull()
    expect(parseGoodreadsDate('August 2026')).toBeNull()
  })
})

describe('parseGoodreadsCsv', () => {
  it('maps every Goodreads exclusive shelf onto app status ids', () => {
    const { books } = parseGoodreadsCsv(csv(
      '1,Want,A,="1",="9780000000001",0,100,,2026/01/01,to-read',
      '2,Reading,B,="2",="9780000000002",0,100,,2026/01/01,currently-reading',
      '3,Done,C,="3",="9780000000003",5,100,2026/02/02,2026/01/01,read',
      '4,Abandoned,D,="4",="9780000000004",0,100,,2026/01/01,did-not-finish',
    ))
    expect(books.map(b => b.statusId)).toEqual([1, 2, 3, 5])
  })

  it('prefers ISBN13 for the book id and falls back to the Goodreads id', () => {
    const { books } = parseGoodreadsCsv(csv(
      '111,HasIsbn,A,="0374619239",="9780374619237",0,100,,2026/01/01,to-read',
      '222,NoIsbn,B,="",="",0,100,,2026/01/01,to-read',
    ))
    expect(books[0].bookId).toBe('isbn:9780374619237')
    expect(books[1].bookId).toBe('gr:222')
  })

  it('accepts ratings written as decimals, which real exports use', () => {
    // Observed in a live Goodreads export: ratings come through as "5.0"
    const { books } = parseGoodreadsCsv(csv(
      '1,Decimal,A,="1",="9780000000001",5.0,100,,2026/01/01,read',
      '2,Zero,B,="2",="9780000000002",0,100,,2026/01/01,read',
    ))
    expect(books[0].rating).toBe(5)
    expect(books[1].rating).toBeNull()
  })

  it('treats a rating of 0 as unrated', () => {
    const { books } = parseGoodreadsCsv(csv(
      '1,Unrated,A,="1",="9780000000001",0,100,,2026/01/01,read',
      '2,Rated,B,="2",="9780000000002",4,100,,2026/01/01,read',
    ))
    expect(books[0].rating).toBeNull()
    expect(books[1].rating).toBe(4)
  })

  it('keeps titles and authors that contain commas intact', () => {
    const { books } = parseGoodreadsCsv(csv(
      '1,"Tomorrow, and Tomorrow","Zevin, Gabrielle",="1",="9780000000001",0,100,,2026/01/01,to-read',
    ))
    expect(books[0].title).toBe('Tomorrow, and Tomorrow')
    expect(books[0].author).toBe('Zevin, Gabrielle')
  })

  it('skips rows with an unusable shelf and reports why', () => {
    const { books, skipped } = parseGoodreadsCsv(csv(
      '1,Good,A,="1",="9780000000001",0,100,,2026/01/01,read',
      '2,Weird,B,="2",="9780000000002",0,100,,2026/01/01,some-custom-shelf',
    ))
    expect(books).toHaveLength(1)
    expect(skipped).toHaveLength(1)
    expect(skipped[0].reason).toContain('some-custom-shelf')
  })

  it('rejects a file that is not a Goodreads export', () => {
    const { books, skipped } = parseGoodreadsCsv('Name,Email\nJack,j@example.com')
    expect(books).toHaveLength(0)
    expect(skipped[0].reason).toContain('Not a Goodreads export')
  })
})

describe('date added', () => {
  it('captures Date Added separately from Date Read', () => {
    const { books } = parseGoodreadsCsv(
      'Book Id,Title,Author,ISBN,ISBN13,My Rating,Number of Pages,Date Read,Date Added,Exclusive Shelf\n' +
      '1,Book,A,="1",="9780000000001",4,100,2026/03/04,2026/01/02,read'
    )
    expect(books[0].dateAdded).not.toBeNull()
    expect(new Date(books[0].dateAdded!).getMonth()).toBe(0) // January
    expect(new Date(books[0].dateRead!).getMonth()).toBe(2)  // March
  })

  it('leaves dateAdded null when the column is blank', () => {
    const { books } = parseGoodreadsCsv(csv(
      '1,Book,A,="1",="9780000000001",0,100,,,to-read',
    ))
    expect(books[0].dateAdded).toBeNull()
  })
})

describe('summarize', () => {
  it('counts each shelf, ratings, and missing ISBNs', () => {
    const { books } = parseGoodreadsCsv(csv(
      '1,A,A,="1",="9780000000001",5,100,2026/02/02,2026/01/01,read',
      '2,B,B,="2",="9780000000002",0,100,,2026/01/01,to-read',
      '3,C,C,="",="",0,100,,2026/01/01,currently-reading',
    ))
    const s = summarize(books)
    expect(s).toMatchObject({
      total: 3,
      read: 1,
      wantToRead: 1,
      currentlyReading: 1,
      rated: 1,
      withoutIsbn: 1,
    })
  })
})
