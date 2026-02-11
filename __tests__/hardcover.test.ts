/**
 * @jest-environment node
 */

describe('Hardcover Helpers', () => {
  describe('getLibbySearchUrl', () => {
    function getLibbySearchUrl(title: string, author: string): string {
      const searchTerms = `title:${title} author:${author}`
      return `https://libbyapp.com/search/${encodeURIComponent(searchTerms)}`
    }

    it('should generate correct Libby URL', () => {
      const url = getLibbySearchUrl('The Great Gatsby', 'F. Scott Fitzgerald')
      expect(url).toContain('libbyapp.com/search/')
      expect(url).toContain('The%20Great%20Gatsby')
      expect(url).toContain('F.%20Scott%20Fitzgerald')
    })

    it('should handle special characters', () => {
      const url = getLibbySearchUrl("Harry Potter & the Philosopher's Stone", "J.K. Rowling")
      expect(url).toContain('libbyapp.com/search/')
      expect(decodeURIComponent(url)).toContain('Harry Potter')
    })
  })

  describe('getBookCoverUrl', () => {
    function getBookCoverUrl(book: { cached_image?: string; isbn_13?: string; isbn_10?: string }): string {
      if (book.cached_image) return book.cached_image
      if (book.isbn_13) return `https://covers.openlibrary.org/b/isbn/${book.isbn_13}-L.jpg`
      if (book.isbn_10) return `https://covers.openlibrary.org/b/isbn/${book.isbn_10}-L.jpg`
      return '/book-placeholder.svg'
    }

    it('should prefer cached_image', () => {
      const url = getBookCoverUrl({ cached_image: 'https://example.com/cover.jpg', isbn_13: '1234567890123' })
      expect(url).toBe('https://example.com/cover.jpg')
    })

    it('should fallback to ISBN-13', () => {
      const url = getBookCoverUrl({ isbn_13: '9780061120084' })
      expect(url).toBe('https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg')
    })

    it('should fallback to ISBN-10', () => {
      const url = getBookCoverUrl({ isbn_10: '0061120081' })
      expect(url).toBe('https://covers.openlibrary.org/b/isbn/0061120081-L.jpg')
    })

    it('should use placeholder when no image available', () => {
      const url = getBookCoverUrl({})
      expect(url).toBe('/book-placeholder.svg')
    })
  })

  describe('getAuthorName', () => {
    function getAuthorName(book: { cached_contributors?: { author: { name: string } }[] }): string {
      if (book.cached_contributors && book.cached_contributors.length > 0) {
        return book.cached_contributors[0].author.name
      }
      return 'Unknown Author'
    }

    it('should return first author name', () => {
      const name = getAuthorName({
        cached_contributors: [{ author: { name: 'J.K. Rowling' } }]
      })
      expect(name).toBe('J.K. Rowling')
    })

    it('should return Unknown Author when no contributors', () => {
      expect(getAuthorName({})).toBe('Unknown Author')
      expect(getAuthorName({ cached_contributors: [] })).toBe('Unknown Author')
    })
  })
})
