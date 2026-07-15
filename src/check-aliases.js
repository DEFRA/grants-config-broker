import { existsSync, readFileSync } from 'node:fs'
import { load } from 'js-yaml'

const ALIAS_FILE = 'config/grant-aliases.yml'

export const createAliasesLookup = async (logger) => {
  logger.info('Checking if there are any grant aliases')
  const aliasesPresent = existsSync(ALIAS_FILE)

  if (!aliasesPresent) {
    logger.info('No alias file found')
    return () => []
  }
  logger.info('Alias file found')

  //if release file found, parse it to see if there is something to consider for current env
  const aliasInfo = load(readFileSync(ALIAS_FILE), 'utf8')

  const aliasLookup = new Map()
  for (const aliasEntry of aliasInfo.aliases) {
    logger.info(
      `Setting aliases for ${aliasEntry.name} to ${aliasEntry.aliases}`
    )
    aliasLookup.set(aliasEntry.name, aliasEntry.aliases)
  }
  return (grantName) =>
    aliasLookup.has(grantName) ? aliasLookup.get(grantName) : []
}
