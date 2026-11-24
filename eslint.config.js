import neostandard from 'neostandard'

export default [
  {
    ignores: [
      ...neostandard.resolveIgnoresFromGitignore(),
      'src/routes/asyncapidocs/**'
    ]
  },
  ...neostandard({
    env: ['node', 'vitest'],
    noJsx: true,
    noStyle: true
  })
]
