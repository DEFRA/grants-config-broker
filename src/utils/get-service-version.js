import { config } from '../config.js'

const LOCAL_SUFFIX_LIMIT = 9999
export const getServiceVersion = () => {
  let serviceVersion = config.get('serviceVersion')
  if (config.get('cdpEnvironment') === 'local') {
    const suffix = Math.floor(Math.random() * LOCAL_SUFFIX_LIMIT)

    serviceVersion += `-${padToFour(suffix)}`
  }
  return serviceVersion
}

const padToFour = (number) =>
  number <= 9999 ? `000${number}`.slice(-4) : number
