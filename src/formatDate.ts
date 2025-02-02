function formatDateToDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDateToTime(date: Date): string {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join(':')
}

function formatDateToDateTime(date: Date): string {
  return [formatDateToDate(date), formatDateToTime(date)].join(' ')
}

export function formatDate(
  date: Date,
  format: 'date' | 'time' | 'datetime',
): string {
  switch (format) {
    case 'date':
      return formatDateToDate(date)
    case 'time':
      return formatDateToTime(date)
    case 'datetime':
      return formatDateToDateTime(date)
  }
}
