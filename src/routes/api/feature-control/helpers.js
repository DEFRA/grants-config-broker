export const deriveChangeUpdatedDefinition = (
  newDefinition,
  oldDefinition,
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
      newDefinition.roleRequired,
      oldDefinition.roleRequired
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
    const oldDate = oldDefinition.expiryDate.toLocaleDateString('en-GB')
    const newDate = newDefinition.expiryDate.toLocaleDateString('en-GB')
    parts.push(`expiryDate: ${oldDate} ➜ ${newDate}`)
  }

  return `Definition: ${parts.join(' | ')}`
}

export const deriveChangeUpdatedValue = (newValue, oldValue, controlType) => {
  if (controlType === 'list-string' || controlType === 'list-number') {
    return `Value: ${deriveAddedRemoved(newValue, oldValue)}`
  }

  // otherwise is string, number or boolean
  return `Value: ${oldValue} ➜ ${newValue}`
}

export const deriveChangeUpdatedStatus = (newStatus, oldStatus) => {
  return `Status: ${oldStatus} ➜ ${newStatus}`
}

const deriveAddedRemoved = (newItems, oldItems) => {
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
