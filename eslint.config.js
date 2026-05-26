import neostandard from 'neostandard'

export default neostandard({
  env: ['node', 'vitest'],
  ignores: [
    ...neostandard.resolveIgnoresFromGitignore(),
    'src/routes/asyncapidocs/*'
  ],
  noJsx: true,
  noStyle: true
})
