/**
 * Derives a string description of changes between two feature control definitions.
 *
 * @param {object} oldDefinition - The original feature control definition.
 * @param {object} newDefinition - The updated feature control definition.
 * @param {string[]} propertiesChanged - An array of property names that have changed.
 * @returns {string} A formatted string describing the changes.
 */
export const deriveChangeUpdatedDefinition = (
  oldDefinition,
  newDefinition,
  propertiesChanged
) => {
  const parts = []

  if (propertiesChanged.includes('scopes')) {
    parts.push(
      `scopes: ${oldDefinition.scopes.join(',')} ➜ ${newDefinition.scopes.join(',')}`
    )
  }

  if (propertiesChanged.includes('roles')) {
    const roleChanges = deriveAddedRemoved(
      oldDefinition.roleRequired,
      newDefinition.roleRequired
    )
    parts.push(`roles: ${roleChanges}`)
  }

  if (propertiesChanged.includes('displayName')) {
    parts.push(
      `displayName: ${oldDefinition.displayName} ➜ ${newDefinition.displayName}`
    )
  }

  if (propertiesChanged.includes('description')) {
    parts.push(
      `description: ${oldDefinition.description} ➜ ${newDefinition.description}`
    )
  }

  if (propertiesChanged.includes('owner')) {
    parts.push(`owner: ${oldDefinition.owner} ➜ ${newDefinition.owner}`)
  }

  if (propertiesChanged.includes('expiryDate')) {
    const oldDate = oldDefinition.expiryDate.toISOString().split('T')[0]
    const newDate = newDefinition.expiryDate.toISOString().split('T')[0]
    parts.push(`expiryDate: ${oldDate} ➜ ${newDate}`)
  }

  return `Definition: ${parts.join(' | ')}`
}

/**
 * Derives a string description of changes between two feature control values.
 *
 * @param {*} oldValue - The original value.
 * @param {*} newValue - The updated value.
 * @param {string} controlType - The type of the feature control (e.g., 'list-string', 'list-number').
 * @returns {string} A formatted string describing the change.
 */
export const deriveChangeUpdatedValue = (oldValue, newValue, controlType) => {
  if (controlType === 'list-string' || controlType === 'list-number') {
    return `Value: ${deriveAddedRemoved(oldValue, newValue)}`
  }

  // otherwise is string, number or boolean
  return `Value: ${oldValue} ➜ ${newValue}`
}

/**
 * Derives a string description of a status change.
 *
 * @param {string} oldStatus - The original status.
 * @param {string} newStatus - The updated status.
 * @returns {string} A formatted string describing the status change.
 */
export const deriveChangeUpdatedStatus = (oldStatus, newStatus) => {
  return `Status: ${oldStatus} ➜ ${newStatus}`
}

const deriveAddedRemoved = (oldItems, newItems) => {
  const oldSet = new Set(oldItems || [])
  const newSet = new Set(newItems || [])

  const added = [...newSet].filter((x) => !oldSet.has(x))
  const removed = [...oldSet].filter((x) => !newSet.has(x))

  const parts = []
  if (added.length > 0) {
    parts.push(`added: ${added.join(',')}`)
  }
  if (removed.length > 0) {
    parts.push(`removed: ${removed.join(',')}`)
  }

  return parts.join(', ')
}
