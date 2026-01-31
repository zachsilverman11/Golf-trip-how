/**
 * Shared trip utility functions (usable in both server and client components)
 */

export function getTripStatus(
  startDate?: string | null,
  endDate?: string | null
): 'upcoming' | 'active' | 'past' | null {
  if (!startDate) return null

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = endDate ? new Date(endDate) : start
  end.setHours(23, 59, 59, 999)

  if (now < start) return 'upcoming'
  if (now > end) return 'past'
  return 'active'
}

export function formatDateRange(
  start?: string | null,
  end?: string | null
): string | null {
  if (!start) return null

  const startDate = new Date(start)
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  if (!end || start === end) {
    return startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })
  }

  const endDate = new Date(end)
  const sameYear = startDate.getFullYear() === endDate.getFullYear()
  const sameMonth = startDate.getMonth() === endDate.getMonth()

  if (sameYear && sameMonth) {
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.getDate()}, ${endDate.getFullYear()}`
  }

  if (sameYear) {
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}, ${endDate.getFullYear()}`
  }

  return `${startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`
}
