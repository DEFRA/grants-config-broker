import { escapeRegex } from './regex-utils.js'

describe('regex-utils', () => {
  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      const input = '/-\\^$*+?.()|[]{}'
      const expected = '\\/\\-\\\\\\^\\$\\*\\+\\?\\.\\(\\)\\|\\[\\]\\{\\}'
      expect(escapeRegex(input)).toBe(expected)
    })

    it('should return empty string for empty string input', () => {
      expect(escapeRegex('')).toBe('')
    })

    it('should not escape normal characters', () => {
      const input = 'abcABC123 '
      expect(escapeRegex(input)).toBe(input)
    })
  })
})
