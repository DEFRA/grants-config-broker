import { health } from '../routes/health.js'
import { versionRoutes } from '../routes/api/version/version-routes.js'
import { releaseRoutes } from '../routes/api/release/release-routes.js'
import { featureControlRoutes } from '../routes/api/feature-control/feature-control-routes.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route(
        [health]
          .concat(versionRoutes)
          .concat(releaseRoutes)
          .concat(featureControlRoutes)
      )
    }
  }
}

export { router }
