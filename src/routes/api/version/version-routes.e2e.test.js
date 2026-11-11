vi.mock('../../../plugins/service-auth.js')

const COLLECTION = 'config-versions'
const GRANT = 'e2e-grant'

const versionDoc = ({ version, status = 'active', grant, archived = null }) => {
  const [versionMajor, versionMinor, versionPatch] = version
    .split('.')
    .map(Number)
  return {
    grant,
    version,
    versionMajor,
    versionMinor,
    versionPatch,
    status,
    manifest: [`${grant}/${version}/config.json`],
    lastUpdated: new Date(),
    ...(archived === true && { archived })
  }
}

describe('version routes (e2e)', () => {
  let server

  beforeAll(async () => {
    const { createServer } = await import('../../../server.js')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(async () => {
    await server.db.collection(COLLECTION).deleteMany({})
  })

  const seed = (docs) => server.db.collection(COLLECTION).insertMany(docs)

  describe('GET /api/latestVersion', () => {
    it('applies the constrainMajor query parameter when querying the DB', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: GRANT }),
        versionDoc({ version: '1.2.0', grant: GRANT }),
        versionDoc({ version: '2.0.0', grant: GRANT })
      ])

      const res = await server.inject({
        method: 'GET',
        url: `/api/latestVersion?grant=${GRANT}&constrainMajor=1`
      })

      expect(res.statusCode).toBe(200)
      expect(res.result.grant).toBe(GRANT)
      expect(res.result.version).toBe('1.2.0')
    })

    it('applies the archived constraint when not present', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: GRANT }),
        versionDoc({ version: '1.2.0', grant: GRANT }),
        versionDoc({ version: '2.0.0', grant: GRANT, archived: true })
      ])

      const res = await server.inject({
        method: 'GET',
        url: `/api/latestVersion?grant=${GRANT}`
      })

      expect(res.statusCode).toBe(200)
      expect(res.result.grant).toBe(GRANT)
      expect(res.result.version).toBe('1.2.0')
    })

    it('returns archived versions when archived is included', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: GRANT }),
        versionDoc({ version: '1.2.0', grant: GRANT }),
        versionDoc({ version: '2.0.0', grant: GRANT, archived: true })
      ])

      const res = await server.inject({
        method: 'GET',
        url: `/api/latestVersion?grant=${GRANT}&archived=include`
      })

      expect(res.statusCode).toBe(200)
      expect(res.result.grant).toBe(GRANT)
      expect(res.result.version).toBe('2.0.0')
      expect(res.result.archived).toBe(true)
    })
  })

  describe('GET /api/allVersions', () => {
    it('applies the draft query parameter when querying the DB', async () => {
      await seed([
        versionDoc({ version: '1.0.0', status: 'active', grant: GRANT }),
        versionDoc({ version: '2.0.0', status: 'draft', grant: GRANT })
      ])

      const res = await server.inject({
        method: 'GET',
        url: `/api/allVersions?grant=${GRANT}&draft=only`
      })

      expect(res.statusCode).toBe(200)
      expect(res.result.map((v) => v.version)).toEqual(['2.0.0'])
      expect(res.result.map((v) => v.archived)).toEqual([false])
    })

    it('applies the archived constraint when not present', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: GRANT }),
        versionDoc({ version: '2.0.0', grant: GRANT, archived: true })
      ])

      const res = await server.inject({
        method: 'GET',
        url: `/api/allVersions?grant=${GRANT}`
      })

      expect(res.statusCode).toBe(200)
      expect(res.result.map((v) => v.version)).toEqual(['1.0.0'])
    })

    it('returns archived versions when archived is included', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: GRANT }),
        versionDoc({ version: '2.0.0', grant: GRANT, archived: true })
      ])

      const res = await server.inject({
        method: 'GET',
        url: `/api/allVersions?grant=${GRANT}&archived=include`
      })

      expect(res.statusCode).toBe(200)
      expect(res.result.map((v) => v.version)).toEqual(['2.0.0', '1.0.0'])
      expect(res.result.map((v) => v.archived)).toEqual([true, false])
    })
  })

  describe('GET /api/allGrants', () => {
    it('returns an entry for every grant in the DB', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: 'grant-a' }),
        versionDoc({ version: '1.0.0', grant: 'grant-b' })
      ])

      const res = await server.inject({
        method: 'GET',
        url: '/api/allGrants'
      })

      expect(res.statusCode).toBe(200)
      expect(res.result.map((g) => g.grant).sort()).toEqual([
        'grant-a',
        'grant-b'
      ])
    })

    it('excludes grants with only archived versions when archived is not present', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: 'grant-a' }),
        versionDoc({ version: '1.0.0', grant: 'grant-b', archived: true })
      ])

      const res = await server.inject({
        method: 'GET',
        url: '/api/allGrants'
      })

      expect(res.statusCode).toBe(200)
      expect(res.result.map((g) => g.grant).sort()).toEqual(['grant-a'])
    })

    it('returns grants with archived versions when archived is included', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: 'grant-a' }),
        versionDoc({ version: '1.0.0', grant: 'grant-b', archived: true })
      ])

      const res = await server.inject({
        method: 'GET',
        url: '/api/allGrants?archived=include'
      })

      expect(res.statusCode).toBe(200)
      expect(res.result.map((g) => g.grant).sort()).toEqual([
        'grant-a',
        'grant-b'
      ])
      const byGrant = Object.fromEntries(res.result.map((g) => [g.grant, g]))
      expect(byGrant['grant-a'].versions[0].archived).toBe(false)
      expect(byGrant['grant-b'].versions[0].archived).toBe(true)
    })
  })

  describe('GET /api/versionHistory', () => {
    it('returns each history entry with its archived flag defaulted', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: GRANT, archived: true }),
        versionDoc({ version: '1.0.0', grant: GRANT })
      ])

      const res = await server.inject({
        method: 'GET',
        url: `/api/versionHistory?grant=${GRANT}&version=1.0.0`
      })

      expect(res.statusCode).toBe(200)
      expect(res.result.map((v) => v.version)).toEqual(['1.0.0', '1.0.0'])
      expect(res.result.map((v) => v.archived).sort()).toEqual([false, true])
    })
  })

  describe('POST /api/version/archive', () => {
    it('archives a version that is not the latest of its major', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: GRANT }),
        versionDoc({ version: '1.1.0', grant: GRANT })
      ])

      const res = await server.inject({
        method: 'POST',
        url: '/api/version/archive',
        payload: { grant: GRANT, version: '1.0.0', user: 'someone' }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ result: 'archived' })

      const archived = await server.db
        .collection(COLLECTION)
        .findOne({ grant: GRANT, version: '1.0.0', archived: true })
      expect(archived).not.toBeNull()
    })
  })

  describe('POST /api/version/unarchive', () => {
    it('unarchives an archived version', async () => {
      await seed([
        versionDoc({ version: '1.0.0', grant: GRANT, archived: true })
      ])

      const res = await server.inject({
        method: 'POST',
        url: '/api/version/unarchive',
        payload: { grant: GRANT, version: '1.0.0', user: 'someone' }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ result: 'unarchived' })

      const unarchived = await server.db
        .collection(COLLECTION)
        .findOne({ grant: GRANT, version: '1.0.0', archived: false })
      expect(unarchived).not.toBeNull()
    })
  })

  describe('query validation', () => {
    it('responds 400 when a required parameter is missing', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/latestVersion'
      })

      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).error).toBe('Bad Request')
    })

    it('responds 400 when a parameter has an invalid value', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/allVersions?grant=${GRANT}&draft=sometimes`
      })

      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).error).toBe('Bad Request')
    })
  })
})
