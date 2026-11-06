import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'

export default [
  {
    ignores: [
      ...resolveIgnoresFromGitignore(),
      'src/routes/asyncapidocs/**'
    ]
  },
  ...neostandard({
    env: ['node', 'vitest'],
    noJsx: true,
    noStyle: true
  })
]
