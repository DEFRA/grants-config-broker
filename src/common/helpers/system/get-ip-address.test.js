import { networkInterfaces } from 'node:os'

vi.mock('node:os', () => ({
  networkInterfaces: vi.fn()
}))

describe('get-ip-address', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('should return the first non-internal IPv4 address found', async () => {
    networkInterfaces.mockReturnValue({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      eth0: [
        { address: 'fe80::1', family: 'IPv6', internal: false },
        { address: '192.168.1.10', family: 'IPv4', internal: false }
      ]
    })
    const { getServiceIp: getServiceIpFresh } =
      await import('./get-ip-address.js')

    const ip = getServiceIpFresh()

    expect(ip).toBe('192.168.1.10')
  })

  it('should return 0.0.0.0 if no non-internal IPv4 address is found', async () => {
    networkInterfaces.mockReturnValue({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      eth0: [{ address: 'fe80::1', family: 'IPv6', internal: false }]
    })
    const { getServiceIp: getServiceIpFresh } =
      await import('./get-ip-address.js')

    const ip = getServiceIpFresh()

    expect(ip).toBe('0.0.0.0')
  })

  it('should return 0.0.0.0 if networkInterfaces throws', async () => {
    networkInterfaces.mockImplementation(() => {
      throw new Error('OS error')
    })
    const { getServiceIp: getServiceIpFresh } =
      await import('./get-ip-address.js')

    const ip = getServiceIpFresh()

    expect(ip).toBe('0.0.0.0')
  })

  it('should cache the result after the first call', async () => {
    networkInterfaces.mockReturnValue({
      eth0: [{ address: '192.168.1.10', family: 'IPv4', internal: false }]
    })
    const { getServiceIp: getServiceIpFresh } =
      await import('./get-ip-address.js')

    const ip1 = getServiceIpFresh()
    expect(ip1).toBe('192.168.1.10')
    expect(networkInterfaces).toHaveBeenCalledTimes(1)

    // Change mock value to verify cache is used
    networkInterfaces.mockReturnValue({
      eth0: [{ address: '10.0.0.1', family: 'IPv4', internal: false }]
    })

    const ip2 = getServiceIpFresh()
    expect(ip2).toBe('192.168.1.10')
    expect(networkInterfaces).toHaveBeenCalledTimes(1)
  })
})
