import { MongoClient } from 'mongodb'
import {
  findVersion,
  getAllGrantsAllVersions,
  getAllVersionsWithConstraints,
  getLatestVersionWithConstraints,
  storeVersion
} from './version-management-repository.js'

const COLLECTION = 'config-versions'
const GRANT = 'integration-test-grant'
const OTHER_GRANT = 'another-test-grant'

const versionDoc = ({
  version,
  status = 'active',
  lastUpdated = new Date(),
  grant = GRANT,
  archived = null
}) => {
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
    lastUpdated,
    ...(archived === true && { archived })
  }
}

// getAllGrantsAllVersions returns one entry per grant; the order of grants in
// the array is not guaranteed, so look entries up by name.
const grantEntry = (result, grant) => result.find((g) => g.grant === grant)

// Seed helpers
const seedFiveVersions = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc({ version: '1.0.0' }),
      versionDoc({ version: '1.1.0' }),
      versionDoc({ version: '1.2.0' }),
      versionDoc({ version: '2.0.0' }),
      versionDoc({ version: '2.1.3' })
    ])

const seedFiveVersionsAllArchived = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc({ version: '1.0.0', archived: true }),
      versionDoc({ version: '1.1.0', archived: true }),
      versionDoc({ version: '1.2.0', archived: true }),
      versionDoc({ version: '2.0.0', archived: true }),
      versionDoc({ version: '2.1.3', archived: true })
    ])

const seedFiveVersionsPartiallyArchived = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc({ version: '1.0.0', archived: false }),
      versionDoc({ version: '1.1.0', archived: false }),
      versionDoc({ version: '1.2.0', archived: true }),
      versionDoc({ version: '2.0.0', archived: true }),
      versionDoc({ version: '2.1.3', archived: false })
    ])

const seedSingleVersion = (db) =>
  db.collection(COLLECTION).insertMany([versionDoc({ version: '1.0.0' })])

const seedSingleArchivedVersion = (db) =>
  db.collection(COLLECTION).insertMany([
    versionDoc({
      version: '1.0.0',
      archived: true,
      lastUpdated: new Date('2024-01-01')
    })
  ])

const seedSingleArchivedVersionWithUpdates = (db) =>
  db.collection(COLLECTION).insertMany([
    versionDoc({
      version: '1.0.0',
      lastUpdated: new Date('2024-01-01')
    }),
    versionDoc({
      version: '1.0.0',
      archived: true,
      lastUpdated: new Date('2024-02-01')
    })
  ])

const seedActiveAndDraft = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc({ version: '1.0.0', status: 'active' }),
      versionDoc({ version: '2.0.0', status: 'active' }),
      versionDoc({ version: '2.1.0', status: 'draft' })
    ])

const seedPromotedVersion = (db) =>
  db.collection(COLLECTION).insertMany([
    versionDoc({
      version: '1.0.0',
      status: 'draft',
      lastUpdated: new Date('2024-01-01')
    }),
    versionDoc({
      version: '1.0.0',
      status: 'active',
      lastUpdated: new Date('2024-02-01')
    })
  ])

const seedTwoGrants = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc({ version: '1.0.0', grant: GRANT }),
      versionDoc({ version: '2.0.0', grant: GRANT }),
      versionDoc({ version: '1.5.0', grant: OTHER_GRANT }),
      versionDoc({ version: '3.0.0', status: 'draft', grant: OTHER_GRANT })
    ])

const seedTwoGrantsThreeAndTwo = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc({ version: '1.0.0', grant: GRANT }),
      versionDoc({ version: '1.1.0', grant: GRANT }),
      versionDoc({ version: '2.0.0', grant: GRANT }),
      versionDoc({ version: '1.5.0', grant: OTHER_GRANT }),
      versionDoc({ version: '3.0.0', grant: OTHER_GRANT })
    ])

const seedTwoGrantsSecondAllArchived = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc({ version: '1.0.0', grant: GRANT }),
      versionDoc({ version: '1.1.0', grant: GRANT }),
      versionDoc({ version: '2.0.0', grant: GRANT }),
      versionDoc({ version: '1.5.0', grant: OTHER_GRANT, archived: true }),
      versionDoc({ version: '3.0.0', grant: OTHER_GRANT, archived: true })
    ])

const seedTwoGrantsEachOneArchived = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc({ version: '1.0.0', grant: GRANT, archived: true }),
      versionDoc({ version: '1.1.0', grant: GRANT }),
      versionDoc({ version: '2.0.0', grant: GRANT }),
      versionDoc({ version: '1.5.0', grant: OTHER_GRANT, archived: true }),
      versionDoc({ version: '3.0.0', grant: OTHER_GRANT })
    ])

const seedTwoGrantsAllArchived = (db) =>
  db
    .collection(COLLECTION)
    .insertMany([
      versionDoc({ version: '1.0.0', grant: GRANT, archived: true }),
      versionDoc({ version: '1.1.0', grant: GRANT, archived: true }),
      versionDoc({ version: '2.0.0', grant: GRANT, archived: true }),
      versionDoc({ version: '1.5.0', grant: OTHER_GRANT, archived: true }),
      versionDoc({ version: '3.0.0', grant: OTHER_GRANT, archived: true })
    ])

describe('version-management-repository (integration)', () => {
  let client
  let db

  beforeAll(async () => {
    client = await MongoClient.connect(process.env.MONGO_URI)
    db = client.db('grants-config-broker')
  })

  afterAll(async () => {
    await client.close()
  })

  describe('getLatestVersionWithConstraints', () => {
    afterEach(async () => {
      await db.collection(COLLECTION).deleteMany({ grant: GRANT })
    })

    it('returns empty when the grant asked for is not present', async () => {
      await seedFiveVersions(db)

      const result = await getLatestVersionWithConstraints({
        grant: 'a-different-grant',
        status: 'active',
        db
      })

      expect(result).toEqual([])
    })

    it('returns empty when there are no versions and no constraints are given', async () => {
      const result = await getLatestVersionWithConstraints({
        grant: GRANT,
        status: 'active',
        db
      })

      expect(result).toEqual([])
    })

    it('returns empty when there are no versions and a constraint is given', async () => {
      const result = await getLatestVersionWithConstraints({
        grant: GRANT,
        status: 'active',
        major: 1,
        db
      })

      expect(result).toEqual([])
    })

    describe('when archive is included', () => {
      describe('when there are 5 non-archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersions(db)
        })

        it('returns the highest version when no constraints are given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.1.3')
        })

        it('returns the highest version within a major constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.2.0')
        })

        it('returns the highest patch within a major and minor constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 1,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.1.0')
        })
      })

      describe('when there are 5 archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersionsAllArchived(db)
        })

        it('returns the highest version when no constraints are given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.1.3')
        })

        it('returns the highest version within a major constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.2.0')
        })

        it('returns the highest patch within a major and minor constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 1,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.1.0')
        })
      })

      describe('when there are 5 partially-archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersionsPartiallyArchived(db)
        })

        it('returns the highest version when no constraints are given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.1.3')
        })

        it('returns the highest version within a major constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.2.0')
        })

        it('returns the highest patch within a major and minor constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 1,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.1.0')
        })
      })

      describe('when there is 1 non-archived version of a grant', () => {
        beforeEach(async () => {
          await seedSingleVersion(db)
        })

        it('returns that version when no constraints are given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
        })

        it('returns that version when the constraint matches', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 0,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
        })

        it('returns empty when the constraint does not match', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 2,
            archived: 'true',
            db
          })

          expect(result).toEqual([])
        })
      })

      describe('when there is 1 archived version of a grant', () => {
        let result
        beforeEach(async () => {
          await seedSingleArchivedVersion(db)

          result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })
        })

        describe('when no constraints are given', () => {
          it('returns the version field', async () => {
            expect(result).toHaveLength(1)
            expect(result[0].version).toBe('1.0.0')
          })

          it('returns the status field', async () => {
            expect(result).toHaveLength(1)
            expect(result[0].status).toBe('active')
          })

          it('returns the lastUpdated field', async () => {
            expect(result).toHaveLength(1)
            expect(result[0].lastUpdated).toStrictEqual(new Date('2024-01-01'))
          })

          it('returns the archived field', async () => {
            expect(result).toHaveLength(1)
            expect(result[0].archived).toBe(true)
          })
        })
      })

      describe('when a version has multiple updates and the last one is archived', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersionWithUpdates(db)
        })

        it('returns the version from its newest (archived) row', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
          expect(result[0].archived).toBe(true)
          expect(result[0].lastUpdated).toStrictEqual(new Date('2024-02-01'))
        })
      })

      describe('when a version has been promoted from draft to active', () => {
        beforeEach(async () => {
          await seedPromotedVersion(db)
        })

        it('reports the newest (active) row when no status is given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
          expect(result[0].status).toBe('active')
        })
      })

      describe('when a grant has both active and draft versions', () => {
        beforeEach(async () => {
          await seedActiveAndDraft(db)
        })

        it('returns the highest active version, ignoring newer drafts', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.0.0')
        })

        it('returns the highest draft version when asking for drafts', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'draft',
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.1.0')
        })

        it('returns the highest version across all statuses when no status is given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.1.0')
        })
      })
    })

    describe('when archive is NOT included', () => {
      describe('when there are 5 non-archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersions(db)
        })

        it('returns the highest version when no constraints are given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.1.3')
        })

        it('returns the highest version within a major constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.2.0')
        })

        it('returns the highest patch within a major and minor constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 1,
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.1.0')
        })
      })

      describe('when there are 5 archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersionsAllArchived(db)
        })

        it('returns empty when no constraints are given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result).toEqual([])
        })

        it('returns the highest version within a major constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            db
          })

          expect(result).toEqual([])
        })

        it('returns the highest patch within a major and minor constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 1,
            db
          })

          expect(result).toEqual([])
        })
      })

      describe('when there are 5 partially-archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersionsPartiallyArchived(db)
        })

        it('returns the highest version when no constraints are given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.1.3')
        })

        it('returns the highest version within a major constraint skipping the archived one', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.1.0')
        })

        it('returns the highest patch within a major and minor constraint', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 1,
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.1.0')
        })

        it('returns empty when a major and minor constraint are for an archived version', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 2,
            db
          })

          expect(result).toEqual([])
        })
      })

      describe('when there is 1 archived version of a grant', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersion(db)
        })

        it('returns empty when no constraints are given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result).toEqual([])
        })

        it('returns empty  when the constraint matches', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 0,
            db
          })

          expect(result).toEqual([])
        })

        it('returns empty when the constraint does not match', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 2,
            db
          })

          expect(result).toEqual([])
        })
      })

      describe('when there is 1 non-archived version of a grant', () => {
        beforeEach(async () => {
          await seedSingleVersion(db)
        })

        it('returns that version when no constraints are given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
        })
      })

      describe('when a grant has both active and draft versions', () => {
        beforeEach(async () => {
          await seedActiveAndDraft(db)
        })

        it('returns the highest active version, ignoring newer drafts', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.0.0')
        })

        it('returns the highest draft version when asking for drafts', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            status: 'draft',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.1.0')
        })

        it('returns the highest version across all statuses when no status is given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('2.1.0')
        })
      })

      describe('when a version has multiple updates and the last one is archived', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersionWithUpdates(db)
        })

        it('returns empty, as the version is currently archived', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            db
          })

          expect(result).toEqual([])
        })
      })

      describe('when a version has been promoted from draft to active', () => {
        beforeEach(async () => {
          await seedPromotedVersion(db)
        })

        it('reports the newest (active) row when no status is given', async () => {
          const result = await getLatestVersionWithConstraints({
            grant: GRANT,
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
          expect(result[0].status).toBe('active')
        })
      })
    })
  })

  describe('getAllVersionsWithConstraints', () => {
    afterEach(async () => {
      await db.collection(COLLECTION).deleteMany({ grant: GRANT })
    })

    it('returns empty when the grant asked for is not present', async () => {
      await seedFiveVersions(db)

      const result = await getAllVersionsWithConstraints({
        grant: 'a-different-grant',
        status: 'active',
        db
      })

      expect(result).toEqual([])
    })

    it('returns empty when there are no versions and no constraints are given', async () => {
      const result = await getAllVersionsWithConstraints({
        grant: GRANT,
        status: 'active',
        db
      })

      expect(result).toEqual([])
    })

    it('returns empty when there are no versions and a constraint is given', async () => {
      const result = await getAllVersionsWithConstraints({
        grant: GRANT,
        status: 'active',
        major: 1,
        db
      })

      expect(result).toEqual([])
    })

    describe('when archive is included', () => {
      describe('when there are 5 non-archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersions(db)
        })

        it('returns all versions highest-first when no constraints are given', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result.map((v) => v.version)).toEqual([
            '2.1.3',
            '2.0.0',
            '1.2.0',
            '1.1.0',
            '1.0.0'
          ])
        })

        it('returns only versions within a major constraint', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            archived: 'true',
            db
          })

          expect(result.map((v) => v.version)).toEqual([
            '1.2.0',
            '1.1.0',
            '1.0.0'
          ])
        })

        it('returns only versions within a major and minor constraint', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 1,
            archived: 'true',
            db
          })

          expect(result.map((v) => v.version)).toEqual(['1.1.0'])
        })
      })

      describe('when there are 5 partially-archived versions of a grant', () => {
        let result
        beforeEach(async () => {
          await seedFiveVersionsPartiallyArchived(db)
          result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })
        })

        it('returns all versions, including the archived ones', async () => {
          expect(result.map((v) => v.version)).toEqual([
            '2.1.3',
            '2.0.0',
            '1.2.0',
            '1.1.0',
            '1.0.0'
          ])
        })

        it('returns the corresponding archive value', async () => {
          expect(result.map((v) => v.archived)).toEqual([
            undefined,
            true,
            true,
            undefined,
            undefined
          ])
        })
      })

      describe('when there are 5 archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersionsAllArchived(db)
        })

        it('returns all versions when no constraints are given', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result.map((v) => v.version)).toEqual([
            '2.1.3',
            '2.0.0',
            '1.2.0',
            '1.1.0',
            '1.0.0'
          ])
        })
      })

      describe('when there is 1 non-archived version of a grant', () => {
        beforeEach(async () => {
          await seedSingleVersion(db)
        })

        it('returns that version when no constraints are given', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result.map((v) => v.version)).toEqual(['1.0.0'])
        })
      })

      describe('when there is 1 archived version of a grant', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersion(db)
        })

        it('returns that version when no constraints are given', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result.map((v) => v.version)).toEqual(['1.0.0'])
        })
      })

      describe('when a version has multiple updates and the last one is archived', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersionWithUpdates(db)
        })

        it('returns the version from its newest (archived) row', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
          expect(result[0].archived).toBe(true)
          expect(result[0].lastUpdated).toStrictEqual(new Date('2024-02-01'))
        })
      })

      describe('when a grant has both active and draft versions', () => {
        // The draft (2.1.0) is higher than the newest active (2.0.0), so the
        // status filter has to actually exclude it from the returned list.
        beforeEach(async () => {
          await seedActiveAndDraft(db)
        })

        it('returns only active versions, ignoring drafts', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result.map((v) => v.version)).toEqual(['2.0.0', '1.0.0'])
        })

        it('returns only draft versions when asking for drafts', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'draft',
            archived: 'true',
            db
          })

          expect(result.map((v) => v.version)).toEqual(['2.1.0'])
        })

        it('returns versions of every status when no status is given', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            archived: 'true',
            db
          })

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
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
          expect(result[0].status).toBe('active')
        })

        it('still returns the lingering draft row when asking for drafts', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'draft',
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
          expect(result[0].status).toBe('draft')
        })

        it('returns the active row when asking for active', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
          expect(result[0].status).toBe('active')
        })
      })
    })

    describe('when archive is NOT included', () => {
      describe('when there are 5 non-archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersions(db)
        })

        it('returns all versions highest-first when no constraints are given', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result.map((v) => v.version)).toEqual([
            '2.1.3',
            '2.0.0',
            '1.2.0',
            '1.1.0',
            '1.0.0'
          ])
        })

        it('returns only versions within a major constraint', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            db
          })

          expect(result.map((v) => v.version)).toEqual([
            '1.2.0',
            '1.1.0',
            '1.0.0'
          ])
        })

        it('returns only versions within a major and minor constraint', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            major: 1,
            minor: 1,
            db
          })

          expect(result.map((v) => v.version)).toEqual(['1.1.0'])
        })
      })

      describe('when there are 5 partially-archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersionsPartiallyArchived(db)
        })

        it('returns only the non-archived versions', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result.map((v) => v.version)).toEqual([
            '2.1.3',
            '1.1.0',
            '1.0.0'
          ])
        })
      })

      describe('when there are 5 archived versions of a grant', () => {
        beforeEach(async () => {
          await seedFiveVersionsAllArchived(db)
        })

        it('returns empty when no constraints are given', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result).toEqual([])
        })
      })

      describe('when there is 1 non-archived version of a grant', () => {
        beforeEach(async () => {
          await seedSingleVersion(db)
        })

        it('returns that version when no constraints are given', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result.map((v) => v.version)).toEqual(['1.0.0'])
        })
      })

      describe('when there is 1 archived version of a grant', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersion(db)
        })

        it('returns empty when no constraints are given', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result).toEqual([])
        })
      })

      describe('when a version has multiple updates and the last one is archived', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersionWithUpdates(db)
        })

        it('returns empty, as the version is currently archived', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            db
          })

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
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result.map((v) => v.version)).toEqual(['2.0.0', '1.0.0'])
        })

        it('returns only draft versions when asking for drafts', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'draft',
            db
          })

          expect(result.map((v) => v.version)).toEqual(['2.1.0'])
        })

        it('returns versions of every status when no status is given', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            db
          })

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
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
          expect(result[0].status).toBe('active')
        })

        it('still returns the lingering draft row when asking for drafts', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'draft',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
          expect(result[0].status).toBe('draft')
        })

        it('returns the active row when asking for active', async () => {
          const result = await getAllVersionsWithConstraints({
            grant: GRANT,
            status: 'active',
            db
          })

          expect(result).toHaveLength(1)
          expect(result[0].version).toBe('1.0.0')
          expect(result[0].status).toBe('active')
        })
      })
    })
  })

  describe('getAllGrantsAllVersions', () => {
    // This query spans every grant, so clear the whole collection each time.
    afterEach(async () => {
      await db.collection(COLLECTION).deleteMany({})
    })

    it('returns an empty list when there are no versions', async () => {
      const result = await getAllGrantsAllVersions({ db })

      expect(result).toEqual([])
    })

    it('returns a single grant with its versions highest-first', async () => {
      await seedFiveVersions(db)

      const result = await getAllGrantsAllVersions({ db })

      expect(result).toHaveLength(1)
      expect(grantEntry(result, GRANT).versions.map((v) => v.version)).toEqual([
        '2.1.3',
        '2.0.0',
        '1.2.0',
        '1.1.0',
        '1.0.0'
      ])
    })

    describe('when archive is included', () => {
      describe('when two grants have 3 and 2 non-archived versions', () => {
        beforeEach(async () => {
          await seedTwoGrantsThreeAndTwo(db)
        })

        it('returns all versions of both grants', async () => {
          const result = await getAllGrantsAllVersions({ archived: 'true', db })

          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.1.0', '1.0.0'])
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['3.0.0', '1.5.0'])
        })
      })

      describe('when there is a single grant with 1 non-archived version', () => {
        beforeEach(async () => {
          await seedSingleVersion(db)
        })

        it('returns that version', async () => {
          const result = await getAllGrantsAllVersions({ archived: 'true', db })

          expect(result).toHaveLength(1)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['1.0.0'])
        })
      })

      describe('when there is a single grant with multiples updates and last one is archived', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersionWithUpdates(db)
        })

        it('returns that version', async () => {
          const result = await getAllGrantsAllVersions({ archived: 'true', db })

          expect(result).toHaveLength(1)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['1.0.0'])
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.lastUpdated)
          ).toStrictEqual([new Date('2024-02-01')])
        })
      })

      describe('when the second grant has only archived versions', () => {
        beforeEach(async () => {
          await seedTwoGrantsSecondAllArchived(db)
        })

        it('returns all versions of both grants', async () => {
          const result = await getAllGrantsAllVersions({ archived: 'true', db })

          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.1.0', '1.0.0'])
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['3.0.0', '1.5.0'])
        })
      })

      describe('when each grant has one archived version', () => {
        beforeEach(async () => {
          await seedTwoGrantsEachOneArchived(db)
        })

        it('returns all versions of both grants', async () => {
          const result = await getAllGrantsAllVersions({ archived: 'true', db })

          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.1.0', '1.0.0'])
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['3.0.0', '1.5.0'])
        })

        it('returns the archive field for all of them', async () => {
          const result = await getAllGrantsAllVersions({ archived: 'true', db })

          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.archived)
          ).toEqual([undefined, undefined, true])
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.archived)
          ).toEqual([undefined, true])
        })
      })

      describe('when all versions of both grants are archived', () => {
        beforeEach(async () => {
          await seedTwoGrantsAllArchived(db)
        })

        it('returns all versions of both grants', async () => {
          const result = await getAllGrantsAllVersions({ archived: 'true', db })

          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.1.0', '1.0.0'])
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['3.0.0', '1.5.0'])
        })
      })

      describe('when there is a single grant with 1 archived version', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersion(db)
        })

        it('returns that version', async () => {
          const result = await getAllGrantsAllVersions({ archived: 'true', db })

          expect(result).toHaveLength(1)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['1.0.0'])
        })
      })

      describe('when two grants also differ by status', () => {
        beforeEach(async () => {
          await seedTwoGrants(db)
        })

        it('returns an entry per grant, each with its own versions highest-first', async () => {
          const result = await getAllGrantsAllVersions({ archived: 'true', db })

          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.0.0'])
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['3.0.0', '1.5.0'])
        })

        it('keeps the status filter per grant when asking for active', async () => {
          const result = await getAllGrantsAllVersions({
            status: 'active',
            archived: 'true',
            db
          })

          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.0.0'])
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['1.5.0'])
        })

        it('only returns grants that have a draft when asking for drafts', async () => {
          const result = await getAllGrantsAllVersions({
            status: 'draft',
            archived: 'true',
            db
          })

          expect(result).toHaveLength(1)
          expect(grantEntry(result, GRANT)).toBeUndefined()
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['3.0.0'])
        })
      })
    })

    describe('when archive is NOT included', () => {
      describe('when two grants have 3 and 2 non-archived versions', () => {
        beforeEach(async () => {
          await seedTwoGrantsThreeAndTwo(db)
        })

        it('returns all versions of both grants', async () => {
          const result = await getAllGrantsAllVersions({ db })

          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.1.0', '1.0.0'])
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['3.0.0', '1.5.0'])
        })
      })

      describe('when there is a single grant with 1 non-archived version', () => {
        beforeEach(async () => {
          await seedSingleVersion(db)
        })

        it('returns that version', async () => {
          const result = await getAllGrantsAllVersions({ db })

          expect(result).toHaveLength(1)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['1.0.0'])
        })
      })

      describe('when there is a single grant with multiples updates and last one is archived', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersionWithUpdates(db)
        })

        it('returns empty', async () => {
          const result = await getAllGrantsAllVersions({ db })

          expect(result).toEqual([])
        })
      })

      describe('when the second grant has only archived versions', () => {
        beforeEach(async () => {
          await seedTwoGrantsSecondAllArchived(db)
        })

        it('returns only the non-archived grant', async () => {
          const result = await getAllGrantsAllVersions({ db })

          expect(result).toHaveLength(1)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.1.0', '1.0.0'])
          expect(grantEntry(result, OTHER_GRANT)).toBeUndefined()
        })
      })

      describe('when each grant has one archived version', () => {
        beforeEach(async () => {
          await seedTwoGrantsEachOneArchived(db)
        })

        it('returns only the non-archived versions of each grant', async () => {
          const result = await getAllGrantsAllVersions({ db })

          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.1.0'])
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['3.0.0'])
        })
      })

      describe('when all versions of both grants are archived', () => {
        beforeEach(async () => {
          await seedTwoGrantsAllArchived(db)
        })

        it('returns an empty list', async () => {
          const result = await getAllGrantsAllVersions({ db })

          expect(result).toEqual([])
        })
      })

      describe('when there is a single grant with 1 archived version', () => {
        beforeEach(async () => {
          await seedSingleArchivedVersion(db)
        })

        it('returns an empty list', async () => {
          const result = await getAllGrantsAllVersions({ db })

          expect(result).toEqual([])
        })
      })

      describe('when two grants also differ by status', () => {
        beforeEach(async () => {
          await seedTwoGrants(db)
        })

        it('returns an entry per grant, each with its own versions highest-first', async () => {
          const result = await getAllGrantsAllVersions({ db })

          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.0.0'])
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['3.0.0', '1.5.0'])
        })

        it('keeps the status filter per grant when asking for active', async () => {
          const result = await getAllGrantsAllVersions({ status: 'active', db })

          // Both grants have active versions, so both are present...
          expect(result).toHaveLength(2)
          expect(
            grantEntry(result, GRANT).versions.map((v) => v.version)
          ).toEqual(['2.0.0', '1.0.0'])
          // ...but OTHER_GRANT's draft 3.0.0 is excluded.
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['1.5.0'])
        })

        it('only returns grants that have a draft when asking for drafts', async () => {
          const result = await getAllGrantsAllVersions({ status: 'draft', db })

          expect(result).toHaveLength(1)
          expect(grantEntry(result, GRANT)).toBeUndefined()
          expect(
            grantEntry(result, OTHER_GRANT).versions.map((v) => v.version)
          ).toEqual(['3.0.0'])
        })
      })
    })
  })

  describe('findVersion', () => {
    afterEach(async () => {
      await db.collection(COLLECTION).deleteMany({ grant: GRANT })
    })

    it('returns the version when it exists', async () => {
      await seedSingleVersion(db)

      const result = await findVersion('1.0.0', GRANT, db)

      expect(result.version).toBe('1.0.0')
      expect(result.grant).toBe(GRANT)
    })

    it('returns undefined when the version does not exist', async () => {
      await seedSingleVersion(db)

      const result = await findVersion('9.9.9', GRANT, db)

      expect(result).toBeUndefined()
    })
  })

  describe('storeVersion', () => {
    afterEach(async () => {
      await db.collection(COLLECTION).deleteMany({ grant: GRANT })
    })

    it('adds the record to the collection', async () => {
      await storeVersion(versionDoc({ version: '1.0.0' }), db)

      const stored = await db
        .collection(COLLECTION)
        .findOne({ grant: GRANT, version: '1.0.0' })

      expect(stored).not.toBeNull()
      expect(stored.version).toBe('1.0.0')
      expect(stored.status).toBe('active')
    })
  })
})
