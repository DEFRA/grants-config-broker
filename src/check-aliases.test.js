import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAliasesLookup } from './check-aliases.js'
import { existsSync, readFileSync } from 'node:fs'
import { load } from 'js-yaml'

vi.mock('node:fs')
vi.mock('js-yaml')

describe('check-aliases', () => {
  const mockLogger = {
    info: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return a function that returns an empty array if the alias file does not exist', async () => {
    existsSync.mockReturnValue(false)

    const aliasLookup = await createAliasesLookup(mockLogger)
    const result = aliasLookup('ANY_GRANT')

    expect(result).toEqual([])
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Checking if there are any grant aliases'
    )
    expect(mockLogger.info).toHaveBeenCalledWith('No alias file found')
  })

  it('should return a function that returns aliases for a given grant name', async () => {
    existsSync.mockReturnValue(true)
    const mockYamlContent = 'mock yaml content'
    readFileSync.mockReturnValue(mockYamlContent)
    load.mockReturnValue({
      aliases: [
        { name: 'GRANT1', aliases: ['ALIAS1', 'ALIAS2'] },
        { name: 'GRANT2', aliases: ['ALIAS3'] }
      ]
    })

    const aliasLookup = await createAliasesLookup(mockLogger)

    expect(aliasLookup('GRANT1')).toEqual(['ALIAS1', 'ALIAS2'])
    expect(aliasLookup('GRANT2')).toEqual(['ALIAS3'])
    expect(aliasLookup('GRANT3')).toEqual([])

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Checking if there are any grant aliases'
    )
    expect(mockLogger.info).toHaveBeenCalledWith('Alias file found')
    expect(readFileSync).toHaveBeenCalledWith('config/grant-aliases.yml')
    expect(load).toHaveBeenCalledWith(mockYamlContent, 'utf8')
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Setting aliases for GRANT1 to ALIAS1,ALIAS2'
    )
    expect(mockLogger.info).toHaveBeenCalledWith(true) // Array.isArray(aliasEntry.aliases)
  })

  it('should handle empty aliases list', async () => {
    existsSync.mockReturnValue(true)
    load.mockReturnValue({
      aliases: []
    })

    const aliasLookup = await createAliasesLookup(mockLogger)
    expect(aliasLookup('ANY')).toEqual([])
  })
})
