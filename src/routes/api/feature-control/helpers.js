export const deriveChange = (newValue, oldValue, controlType) => {
  if (controlType === 'list-string' || controlType === 'list-number') {
    const oldSet = new Set(oldValue || [])
    const newSet = new Set(newValue || [])

    const added = [...newSet].filter((x) => !oldSet.has(x))
    const removed = [...oldSet].filter((x) => !newSet.has(x))

    const parts = []
    if (added.length > 0) {
      parts.push(`Added: ${added.join(',')}`)
    }
    if (removed.length > 0) {
      parts.push(`Removed: ${removed.join(',')}`)
    }

    return parts.join(' | ')
  }

  // otherwise is string, number or boolean
  return `${oldValue} ➜ ${newValue}`
}

export const isDateTodayOrEarlier = (date) => {
  return (
    new Date(date).setUTCHours(0, 0, 0, 0) <= new Date().setUTCHours(0, 0, 0, 0)
  )
}
