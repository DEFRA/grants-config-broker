import { config } from '../config.js'

const LOCAL_SUFFIX_LIMIT = 9999
export const getServiceVersion = () => {
  let serviceVersion = config.get('serviceVersion')
  if (config.get('cdpEnvironment') === 'local') {
    serviceVersion += `-${Math.floor(Math.random() * LOCAL_SUFFIX_LIMIT)}`
  }
  return serviceVersion
}
