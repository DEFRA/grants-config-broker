import {
  deriveChangeUpdatedValue,
  deriveChangeUpdatedDefinition,
  deriveChangeUpdatedStatus
} from './helpers.js'

describe('helpers', () => {
  describe('deriveChangeUpdatedDefinition', () => {
    it('should format all changed properties correctly', () => {
      const oldDefinition = {
        scopes: ['old-scope'],
        roleRequired: ['role-removed'],
        displayName: 'old name',
        description: 'old desc',
        owner: 'old owner',
        expiryDate: new Date('2027-01-01T00:00:00Z')
      }
      const newDefinition = {
        scopes: ['new-scope'],
        roleRequired: ['role-added'],
        displayName: 'new name',
        description: 'new desc',
        owner: 'new owner',
        expiryDate: new Date('2030-01-01T00:00:00Z')
      }
      const propertiesChanged = [
        'scopes',
        'roles',
        'displayName',
        'description',
        'owner',
        'expiryDate'
      ]

      const result = deriveChangeUpdatedDefinition(
        oldDefinition,
        newDefinition,
        propertiesChanged
      )

      expect(result).toBe(
        'Definition: scopes: old-scope ➜ new-scope | roles: added: role-added, removed: role-removed | displayName: old name ➜ new name | description: old desc ➜ new desc | owner: old owner ➜ new owner | expiryDate: 2027-01-01 ➜ 2030-01-01'
      )
    })

    it('should format only subset of changed properties', () => {
      const oldDefinition = {
        displayName: 'old name'
      }
      const newDefinition = {
        displayName: 'new name'
      }
      const propertiesChanged = ['displayName']

      const result = deriveChangeUpdatedDefinition(
        oldDefinition,
        newDefinition,
        propertiesChanged
      )

      expect(result).toBe('Definition: displayName: old name ➜ new name')
    })

    it('should handle added and removed roles correctly', () => {
      const oldDefinition = {
        roleRequired: ['role1', 'role2']
      }
      const newDefinition = {
        roleRequired: ['role2', 'role3']
      }
      const propertiesChanged = ['roles']

      const result = deriveChangeUpdatedDefinition(
        oldDefinition,
        newDefinition,
        propertiesChanged
      )

      expect(result).toBe('Definition: roles: added: role3, removed: role1')
    })

    it('should handle only added roles', () => {
      const oldDefinition = { roleRequired: [] }
      const newDefinition = { roleRequired: ['role1'] }
      const result = deriveChangeUpdatedDefinition(
        oldDefinition,
        newDefinition,
        ['roles']
      )
      expect(result).toBe('Definition: roles: added: role1')
    })

    it('should handle only removed roles', () => {
      const oldDefinition = { roleRequired: ['role1'] }
      const newDefinition = { roleRequired: [] }
      const result = deriveChangeUpdatedDefinition(
        oldDefinition,
        newDefinition,
        ['roles']
      )
      expect(result).toBe('Definition: roles: removed: role1')
    })

    it('should handle undefined roles in old or new definition', () => {
      expect(
        deriveChangeUpdatedDefinition({}, { roleRequired: ['role1'] }, [
          'roles'
        ])
      ).toBe('Definition: roles: added: role1')
      expect(
        deriveChangeUpdatedDefinition({ roleRequired: ['role1'] }, {}, [
          'roles'
        ])
      ).toBe('Definition: roles: removed: role1')
    })
  })

  describe('deriveChangeUpdatedValue', () => {
    describe('string, number and boolean', () => {
      it('should return "Value: old ➜ new" when both exist', () => {
        expect(deriveChangeUpdatedValue('old', 'new', 'string')).toBe(
          'Value: old ➜ new'
        )
        expect(deriveChangeUpdatedValue(1, 2, 'number')).toBe('Value: 1 ➜ 2')
        expect(deriveChangeUpdatedValue(false, true, 'boolean')).toBe(
          'Value: false ➜ true'
        )
      })
    })

    describe('list types', () => {
      it('should return Value: added/removed correctly', () => {
        const oldVal = ['a']
        const newVal = ['b']
        expect(deriveChangeUpdatedValue(oldVal, newVal, 'list-string')).toBe(
          'Value: added: b, removed: a'
        )
      })

      it('should handle only added in list types', () => {
        expect(deriveChangeUpdatedValue([], ['a'], 'list-string')).toBe(
          'Value: added: a'
        )
      })

      it('should handle only removed in list types', () => {
        expect(deriveChangeUpdatedValue(['a'], [], 'list-string')).toBe(
          'Value: removed: a'
        )
      })

      it('should handle undefined/null oldValue in list types', () => {
        expect(deriveChangeUpdatedValue(undefined, ['a'], 'list-string')).toBe(
          'Value: added: a'
        )
        expect(deriveChangeUpdatedValue(null, ['a'], 'list-string')).toBe(
          'Value: added: a'
        )
      })

      it('should handle undefined/null newValue in list types', () => {
        expect(deriveChangeUpdatedValue(['a'], undefined, 'list-string')).toBe(
          'Value: removed: a'
        )
        expect(deriveChangeUpdatedValue(['a'], null, 'list-string')).toBe(
          'Value: removed: a'
        )
      })
    })
  })

  describe('deriveChangeUpdatedStatus', () => {
    it('should return "Status: old ➜ new"', () => {
      expect(deriveChangeUpdatedStatus('old', 'new')).toBe('Status: old ➜ new')
    })
  })
})
