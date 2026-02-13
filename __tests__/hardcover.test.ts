/**
 * @jest-environment node
 */

// Mock fetch to prevent hardcover.ts from hanging on Next.js fetch options
global.fetch = jest.fn()

import { getLibbySearchUrl, getBookCoverUrl, getAuthorName } from '@/lib/hardcover'

describe('Hardcover Helpers', () => {
  describe('getLibbySearchUrl', () => {
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
    it('should prefer cached_image url', () => {
      const url = getBookCoverUrl({
        id: 1, title: 'Test', slug: 'test',
        cached_image: { url: 'https://example.com/cover.jpg' },
      })
      expect(url).toBe('https://example.com/cover.jpg')
    })

    it('should use placeholder when no image available', () => {
      const url = getBookCoverUrl({
        id: 1, title: 'Test', slug: 'test',
        cached_image: null,
      })
      expect(url).toBe('/book-placeholder.svg')
    })

    it('should use placeholder when cached_image is undefined', () => {
      const url = getBookCoverUrl({
        id: 1, title: 'Test', slug: 'test',
      })
      expect(url).toBe('/book-placeholder.svg')
    })
  })

  describe('getAuthorName', () => {
    it('should return first author name', () => {
      const name = getAuthorName({
        id: 1, title: 'Test', slug: 'test',
        cached_contributors: [{ author: { name: 'J.K. Rowling', slug: 'jk-rowling' } }]
      })
      expect(name).toBe('J.K. Rowling')
    })

    it('should return Unknown Author when no contributors', () => {
      expect(getAuthorName({ id: 1, title: 'Test', slug: 'test' })).toBe('Unknown Author')
      expect(getAuthorName({ id: 1, title: 'Test', slug: 'test', cached_contributors: [] })).toBe('Unknown Author')
    })
  })
})
