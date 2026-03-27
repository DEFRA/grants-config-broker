import { config } from '../config.js'

const LOCAL_SUFFIX_LIMIT = 9999
const LOCAL_SUFFIX_TAKE_FOUR = -4
export const getServiceVersion = () => {
  let serviceVersion = config.get('serviceVersion')
  if (config.get('cdpEnvironment') === 'local') {
    const suffix = Math.floor(Math.random() * LOCAL_SUFFIX_LIMIT)

    serviceVersion += `-${padToFour(suffix)}`
  }
  return serviceVersion
}

const padToFour = (number) =>
  number <= LOCAL_SUFFIX_LIMIT
    ? `000${number}`.slice(LOCAL_SUFFIX_TAKE_FOUR)
    : number
