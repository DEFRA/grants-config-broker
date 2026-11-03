import { defineConfig, configDefaults } from 'vitest/config'

const shared = {
  globals: true,
  environment: 'node',
  clearMocks: true
}

const unitSetup = ['.vite/setup-files.js', '.vite/trap-unhandled.js']
const dbSetup = ['.vite/mongo-memory-server.js', ...unitSetup]

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        ...configDefaults.exclude,
        'coverage',
        'src/routes/asyncapidocs/**' // generated 2.5 MB AsyncAPI UI bundle
      ]
    },
    projects: [
      {
        test: {
          ...shared,
          name: 'unit',
          fileParallelism: true,
          include: ['src/**/*.test.js'],
          exclude: [
            ...configDefaults.exclude,
            'src/**/*.int.test.js',
            'src/**/*.e2e.test.js'
          ],
          setupFiles: unitSetup
        }
      },
      {
        test: {
          ...shared,
          fileParallelism: false,
          name: 'integration',
          include: ['src/**/*.int.test.js'],
          setupFiles: dbSetup
        }
      },
      {
        test: {
          ...shared,
          fileParallelism: false,
          name: 'e2e',
          include: ['src/**/*.e2e.test.js'],
          setupFiles: dbSetup
        }
      }
    ]
  }
})
