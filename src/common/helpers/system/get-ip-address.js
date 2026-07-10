import { networkInterfaces } from 'node:os'

let cachedServiceIp = null

/**
 * Resolves and caches this service's own non-internal IPv4 address.
 *
 * This helper scans the system's network interfaces to find the first available
 * non-internal IPv4 address. This is primarily used as a fallback for audit logging
 * when an event originates from a background process (like an inbound SQS message)
 * where no HTTP request context is available to provide a source IP.
 *
 * Once a suitable IP is found, it is cached for the lifetime of the process to
 * avoid repeated system calls to `networkInterfaces()`.
 *
 * @returns {string} The resolved IPv4 address, or '0.0.0.0' if no external interface is found or an error occurs.
 * @example
 * const ip = getServiceIp();
 * // returns '192.168.1.10' or '0.0.0.0'
 */
export const getServiceIp = () => {
  if (cachedServiceIp) {
    return cachedServiceIp
  }

  try {
    const interfaces = networkInterfaces()
    for (const addrs of Object.values(interfaces)) {
      for (const addr of addrs ?? []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          cachedServiceIp = addr.address
          return cachedServiceIp
        }
      }
    }
  } catch {
    // ignore — fall through to loopback default
  }

  cachedServiceIp = '0.0.0.0'
  return cachedServiceIp
}
