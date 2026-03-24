import { config } from '../config.js'

export const getServiceVersion = () => {
  let serviceVersion = config.get('serviceVersion')
  if (config.get('cdpEnvironment') === 'local') {
    serviceVersion += `-${Math.floor(Math.random() * 9999)}`
  }
  return serviceVersion
}
