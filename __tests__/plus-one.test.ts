/**
 * @jest-environment node
 */

describe('Plus One Logic', () => {
  describe('Plus one validation', () => {
    function validatePlusOne(data: { userId?: string; hardcoverBookId?: string }) {
      const errors: string[] = []
      if (!data.userId) errors.push('userId required')
      if (!data.hardcoverBookId) errors.push('hardcoverBookId required')
      return errors
    }

    it('should validate required fields', () => {
      const errors = validatePlusOne({})
      expect(errors).toContain('userId required')
      expect(errors).toContain('hardcoverBookId required')
    })

    it('should pass valid plus one', () => {
      const errors = validatePlusOne({
        userId: 'user-1',
        hardcoverBookId: '12345',
      })
      expect(errors).toHaveLength(0)
    })
  })

  describe('Plus one deduplication', () => {
    it('should track unique book-user pairs', () => {
      const plusOnes = new Map<string, string>()

      const key1 = 'user-1:book-1'
      const key2 = 'user-1:book-2'
      const key3 = 'user-1:book-1' // duplicate

      plusOnes.set(key1, 'first')
      plusOnes.set(key2, 'second')
      plusOnes.set(key3, 'third') // should overwrite

      expect(plusOnes.size).toBe(2)
      expect(plusOnes.get(key1)).toBe('third')
    })
  })
})
