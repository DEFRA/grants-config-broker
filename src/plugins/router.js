import { health } from '../routes/health.js'
import { versionRoutes } from '../routes/api/version-routes.js'
import { releaseRoutes } from '../routes/api/release-routes.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([health].concat(versionRoutes).concat(releaseRoutes))
    }
  }
}

export { router }
