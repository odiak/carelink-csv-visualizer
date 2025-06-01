import { formatDate } from '../formatDate'

export function getShortTime(date: Date): string {
  return formatDate(date, 'time').slice(0, 5)
}
