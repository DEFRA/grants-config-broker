import { health } from '../routes/health.js'
import { versionRoutes } from '../routes/api/version-routes.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([health].concat(versionRoutes))
    }
  }
}

export { router }
