import { config } from '../config.js'
import { getServiceVersion } from './get-service-version.js'

describe('get-service-version', () => {
  it('should return the version defined in config object when non local environment', () => {
    config.set('serviceVersion', '1.2.3')
    config.set('cdpEnvironment', 'test')
    expect(getServiceVersion()).toBe('1.2.3')
  })

  it('should return custom suffixed version when local environment', () => {
    config.set('serviceVersion', '1.2.3')
    config.set('cdpEnvironment', 'local')
    expect(getServiceVersion()).toMatch(/1\.2\.3-\d{4}/)
  })
})
