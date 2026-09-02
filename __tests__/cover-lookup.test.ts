import {
  cleanTitle,
  coverUrlByIsbn,
  coverUrlByOpenLibraryId,
  authorsOverlap,
} from '@/lib/cover-lookup'

describe('authorsOverlap', () => {
  it('rejects an unrelated author, which is how a wrong cover slips in', () => {
    // "Lion Hearts (Essex Dogs Trilogy, #3)" cleaned to "Lion Hearts" and
    // matched Poul Anderson's "Three Hearts and Three Lions"
    expect(authorsOverlap('Dan Jones', ['Poul Anderson'])).toBe(false)
  })

  it('matches across accent differences between catalogs', () => {
    expect(authorsOverlap('Carlos Ruiz Zafón', ['Carlos Ruiz Zafon'])).toBe(true)
    expect(authorsOverlap('Anne Hebert', ['Anne Hébert'])).toBe(true)
  })

  it('matches when one catalog adds or drops a middle name', () => {
    expect(authorsOverlap('Thomas M. Nichols', ['Thomas Nichols'])).toBe(true)
    expect(authorsOverlap('Jon Meacham', ['Jon Meacham'])).toBe(true)
  })

  it('matches against any author in a multi-author list', () => {
    expect(authorsOverlap('Rob Reich', ['Mehran Sahami', 'Rob Reich'])).toBe(true)
  })

  it('ignores short tokens like initials that would match by luck', () => {
    // "M." shouldn't make two unrelated authors look like a match
    expect(authorsOverlap('M. Smith', ['M. Johnson'])).toBe(false)
  })

  it('returns false when we have no usable author', () => {
    expect(authorsOverlap('', ['Someone'])).toBe(false)
    expect(authorsOverlap('Dan Jones', [])).toBe(false)
  })
})

describe('cleanTitle', () => {
  it('drops a numbered series suffix', () => {
    // These exact titles failed catalog lookup until the suffix was removed
    expect(cleanTitle('Red Rising (Red Rising Saga, #1)')).toBe('Red Rising')
    expect(cleanTitle('The Shadow of the Wind (The Cemetery of Forgotten Books, #1)'))
      .toBe('The Shadow of the Wind')
    expect(cleanTitle('Lion Hearts (Essex Dogs Trilogy, #3)')).toBe('Lion Hearts')
  })

  it('drops an unnumbered series suffix', () => {
    expect(cleanTitle('Leviathan Wakes (The Expanse Series)')).toBe('Leviathan Wakes')
  })

  it('drops a subtitle after a colon', () => {
    expect(cleanTitle('Far from the Tree: Parents, Children, and the Search for Identity'))
      .toBe('Far from the Tree')
    expect(cleanTitle('System Error: Where Big Tech Went Wrong')).toBe('System Error')
  })

  it('leaves a plain title untouched', () => {
    expect(cleanTitle('Trust')).toBe('Trust')
    expect(cleanTitle('The Lincoln Highway')).toBe('The Lincoln Highway')
  })

  it('keeps parentheses that are part of the title itself', () => {
    expect(cleanTitle('Girl (Interrupted)')).toBe('Girl (Interrupted)')
  })

  it('does not strip a leading colon-less title to nothing', () => {
    expect(cleanTitle('1984')).toBe('1984')
  })
})

describe('cover URLs', () => {
  it('asks Open Library to 404 rather than return a blank image', () => {
    // Without default=false, a missing cover answers 200 with a 43-byte blank,
    // which renders as an empty box and never fires an error handler
    expect(coverUrlByIsbn('9780374619237')).toContain('default=false')
  })

  it('builds a cover-by-id URL from a search result', () => {
    expect(coverUrlByOpenLibraryId(7434532))
      .toBe('https://covers.openlibrary.org/b/id/7434532-L.jpg')
  })
})
