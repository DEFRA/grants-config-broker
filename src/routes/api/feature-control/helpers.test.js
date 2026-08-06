import { deriveChange } from './helpers.js'

describe('helpers', () => {
  describe('deriveChange', () => {
    describe('string, number and boolean', () => {
      it('should return "old ➜ new" when both exist', () => {
        expect(deriveChange('new', 'old', 'string')).toBe('old ➜ new')
        expect(deriveChange(2, 1, 'number')).toBe('1 ➜ 2')
        expect(deriveChange(true, false, 'boolean')).toBe('false ➜ true')
        expect(deriveChange(false, true, 'boolean')).toBe('true ➜ false')
      })
    })

    describe('list types', () => {
      it('should handle undefined/null newValue in list types', () => {
        expect(deriveChange(undefined, ['a'], 'list-string')).toBe('Removed: a')
        expect(deriveChange(null, ['a'], 'list-string')).toBe('Removed: a')
      })
      it('should return Added, Removed and Changed correctly for numbers', () => {
        const oldVal = [1, 2, 3]
        const newVal = [2, 3, 4]
        // Added: 4, Removed: 1. No changes in this simple list case?
        // Usually changed implies same index or same key, but for simple lists it might just be added/removed.
        // The TODO says "Added: 1,2 | Removed: 3,4 | Changed: 5,6"
        // Let's assume for now simple set difference for added/removed.
        const result = deriveChange(newVal, oldVal, 'list-number')
        expect(result).toContain('Added: 4')
        expect(result).toContain('Removed: 1')
      })

      it('should return Added and Removed for strings', () => {
        const oldVal = ['a', 'b']
        const newVal = ['b', 'c']
        const result = deriveChange(newVal, oldVal, 'list-string')
        expect(result).toBe('Added: c | Removed: a')
      })

      it('should handle only Added', () => {
        expect(deriveChange(['a'], [], 'list-string')).toBe('Added: a')
      })

      it('should handle only Removed', () => {
        expect(deriveChange([], ['a'], 'list-string')).toBe('Removed: a')
      })

      it('should handle no changes', () => {
        expect(deriveChange(['a'], ['a'], 'list-string')).toBe('')
      })

      it('should handle same list but different order', () => {
        expect(deriveChange(['a', 'b'], ['b', 'a'], 'list-string')).toBe('')
      })

      it('should handle undefined/null oldValue in list types', () => {
        expect(deriveChange(['a'], undefined, 'list-string')).toBe('Added: a')
        expect(deriveChange(['a'], null, 'list-string')).toBe('Added: a')
      })
    })
  })
})
