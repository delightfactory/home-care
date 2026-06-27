export const toLocalDateISO = (date: Date): string => {
  const tzOffset = date.getTimezoneOffset() * 60000 // compensate local timezone
  return new Date(date.getTime() - tzOffset).toISOString().split('T')[0]
}

export const getToday = (): string => {
  return toLocalDateISO(new Date())
}

export const getTomorrow = (): string => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return toLocalDateISO(tomorrow)
}

export const getStartOfMonth = (): string => {
  const date = new Date()
  return toLocalDateISO(new Date(date.getFullYear(), date.getMonth(), 1))
}

export const getEndOfMonth = (): string => {
  const date = new Date()
  return toLocalDateISO(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export const getDateRange = (days: number): { start: string; end: string } => {
  const end = new Date()
  const start = new Date(end.getTime() - (days * 24 * 60 * 60 * 1000))

  return {
    start: toLocalDateISO(start),
    end: toLocalDateISO(end)
  }
}