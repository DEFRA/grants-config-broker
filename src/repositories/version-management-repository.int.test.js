import { MongoClient } from 'mongodb'
import {
  getAllVersionsWithConstraints,
  getLatestVersionWithConstraints
} from './version-management-repository.js'

const COLLECTION = 'config-versions'
const GRANT = 'integration-test-grant'

const versionDoc = (version, status = 'active', lastUpdated = new Date()) => {
  const [versionMajor, versionMinor, versionPatch] = version
    .split('.')
    .map(Number)
  return {
    grant: GRANT,
    version,
    versionMajor,
    versionMinor,
    versionPatch,
    status,
    manifest: [`${GRANT}/${version}/config.json`],
    lastUpdated
  }
}

// Seed helpers
const seedFiveVersions = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc('1.0.0'),
      versionDoc('1.1.0'),
      versionDoc('1.2.0'),
      versionDoc('2.0.0'),
      versionDoc('2.1.3')
    ])

const seedSingleVersion = (db) =>
  db.collection(COLLECTION).insertMany([versionDoc('1.0.0')])

const seedActiveAndDraft = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc('1.0.0', 'active'),
      versionDoc('2.0.0', 'active'),
      versionDoc('2.1.0', 'draft')
    ])

// The same version released first as draft then promoted to active. Rows are
// append-only, so both rows coexist; the active one has the newer lastUpdated.
const seedPromotedVersion = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc('1.0.0', 'draft', new Date('2024-01-01')),
      versionDoc('1.0.0', 'active', new Date('2024-02-01'))
    ])

describe('version-management-repository (integration)', () => {
  let client
  let db

  beforeAll(async () => {
    // MONGO_URI is set by the mongo-memory-server setup file (dbSetup)
    client = await MongoClient.connect(process.env.MONGO_URI)
    db = client.db('grants-config-broker')
  })

  afterAll(async () => {
    await client.close()
  })

  describe('getLatestVersionWithConstraints', () => {
    // Shared cleanup: every case removes whatever it seeded for this grant.
    afterEach(async () => {
      await db.collection(COLLECTION).deleteMany({ grant: GRANT })
    })

    describe('when there are 5 versions of a grant', () => {
      beforeEach(async () => {
        await seedFiveVersions(db)
      })

      it('returns the highest version when no constraints are given', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          'active',
          null,
          null,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('2.1.3')
      })

      it('returns the highest version within a major constraint', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          'active',
          1,
          null,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('1.2.0')
      })

      it('returns the highest patch within a major and minor constraint', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          'active',
          1,
          1,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('1.1.0')
      })

      it('returns empty when the grant asked for is not present', async () => {
        const result = await getLatestVersionWithConstraints(
          'a-different-grant',
          'active',
          null,
          null,
          db
        )

        expect(result).toEqual([])
      })
    })

    describe('when there is 1 version of a grant', () => {
      beforeEach(async () => {
        await seedSingleVersion(db)
      })

      it('returns that version when no constraints are given', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          'active',
          null,
          null,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('1.0.0')
      })

      it('returns that version when the constraint matches', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          'active',
          1,
          0,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('1.0.0')
      })

      it('returns empty when the constraint does not match', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          'active',
          2,
          null,
          db
        )

        expect(result).toEqual([])
      })
    })

    describe('when there are 0 versions of a grant', () => {
      it('returns empty when no constraints are given', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          'active',
          null,
          null,
          db
        )

        expect(result).toEqual([])
      })

      it('returns empty when a constraint is given', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          'active',
          1,
          null,
          db
        )

        expect(result).toEqual([])
      })
    })

    describe('when a grant has both active and draft versions', () => {
      // The draft (2.1.0) is higher than the newest active (2.0.0), so the
      // status filter has to actually exclude it to return the right version.
      beforeEach(async () => {
        await seedActiveAndDraft(db)
      })

      it('returns the highest active version, ignoring newer drafts', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          'active',
          null,
          null,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('2.0.0')
      })

      it('returns the highest draft version when asking for drafts', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          'draft',
          null,
          null,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('2.1.0')
      })

      it('returns the highest version across all statuses when no status is given', async () => {
        const result = await getLatestVersionWithConstraints(
          GRANT,
          null,
          null,
          null,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('2.1.0')
      })
    })
  })

  describe('getAllVersionsWithConstraints', () => {
    // Shared cleanup: every case removes whatever it seeded for this grant.
    afterEach(async () => {
      await db.collection(COLLECTION).deleteMany({ grant: GRANT })
    })

    describe('when there are 5 versions of a grant', () => {
      beforeEach(async () => {
        await seedFiveVersions(db)
      })

      it('returns all versions highest-first when no constraints are given', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'active',
          null,
          null,
          db
        )

        expect(result.map((v) => v.version)).toEqual([
          '2.1.3',
          '2.0.0',
          '1.2.0',
          '1.1.0',
          '1.0.0'
        ])
      })

      it('returns only versions within a major constraint', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'active',
          1,
          null,
          db
        )

        expect(result.map((v) => v.version)).toEqual([
          '1.2.0',
          '1.1.0',
          '1.0.0'
        ])
      })

      it('returns only versions within a major and minor constraint', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'active',
          1,
          1,
          db
        )

        expect(result.map((v) => v.version)).toEqual(['1.1.0'])
      })

      it('returns empty when the grant asked for is not present', async () => {
        const result = await getAllVersionsWithConstraints(
          'a-different-grant',
          'active',
          null,
          null,
          db
        )

        expect(result).toEqual([])
      })
    })

    describe('when there is 1 version of a grant', () => {
      beforeEach(async () => {
        await seedSingleVersion(db)
      })

      it('returns that version when no constraints are given', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'active',
          null,
          null,
          db
        )

        expect(result.map((v) => v.version)).toEqual(['1.0.0'])
      })

      it('returns that version when the constraint matches', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'active',
          1,
          0,
          db
        )

        expect(result.map((v) => v.version)).toEqual(['1.0.0'])
      })

      it('returns empty when the constraint does not match', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'active',
          2,
          null,
          db
        )

        expect(result).toEqual([])
      })
    })

    describe('when there are 0 versions of a grant', () => {
      it('returns empty when no constraints are given', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'active',
          null,
          null,
          db
        )

        expect(result).toEqual([])
      })

      it('returns empty when a constraint is given', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'active',
          1,
          null,
          db
        )

        expect(result).toEqual([])
      })
    })

    describe('when a grant has both active and draft versions', () => {
      // The draft (2.1.0) is higher than the newest active (2.0.0), so the
      // status filter has to actually exclude it from the returned list.
      beforeEach(async () => {
        await seedActiveAndDraft(db)
      })

      it('returns only active versions, ignoring drafts', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'active',
          null,
          null,
          db
        )

        expect(result.map((v) => v.version)).toEqual(['2.0.0', '1.0.0'])
      })

      it('returns only draft versions when asking for drafts', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'draft',
          null,
          null,
          db
        )

        expect(result.map((v) => v.version)).toEqual(['2.1.0'])
      })

      it('returns versions of every status when no status is given', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          null,
          null,
          null,
          db
        )

        expect(result.map((v) => v.version)).toEqual([
          '2.1.0',
          '2.0.0',
          '1.0.0'
        ])
      })
    })

    describe('when a version has been promoted from draft to active', () => {
      beforeEach(async () => {
        await seedPromotedVersion(db)
      })

      it('dedupes to a single row of the newest (active) status when no status is given', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          null,
          null,
          null,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('1.0.0')
        expect(result[0].status).toBe('active')
      })

      it('still returns the lingering draft row when asking for drafts', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'draft',
          null,
          null,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('1.0.0')
        expect(result[0].status).toBe('draft')
      })

      it('returns the active row when asking for active', async () => {
        const result = await getAllVersionsWithConstraints(
          GRANT,
          'active',
          null,
          null,
          db
        )

        expect(result).toHaveLength(1)
        expect(result[0].version).toBe('1.0.0')
        expect(result[0].status).toBe('active')
      })
    })
  })
})
