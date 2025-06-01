import { LogEntry } from '../parse'
import { formatDate } from '../formatDate'

/** Moving average data point */
export interface MovingAveragePoint {
  timestamp: Date
  value: number
}

/** calculate moving average for all dates at once */
export function calculateAllMovingAverages(
  allEntries: LogEntry[],
  windowHours: number = 24,
): Map<string, MovingAveragePoint[]> {
  const sensorBgEntries = allEntries
    .filter(
      (entry): entry is Extract<LogEntry, { type: 'sensor-bg' }> =>
        entry.type === 'sensor-bg',
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  if (sensorBgEntries.length === 0) {
    return new Map()
  }

  // Get all unique dates
  const uniqueDates = new Set<string>()
  for (const entry of sensorBgEntries) {
    const dateStr = formatDate(entry.timestamp, 'date')
    uniqueDates.add(dateStr)
  }

  const movingAveragesByDate = new Map<string, MovingAveragePoint[]>()

  // Pre-create an array of all time points we want to calculate for efficiency
  const timePoints: Array<{ date: Date; dateStr: string }> = []
  for (const dateStr of uniqueDates) {
    const targetDate = new Date(dateStr)
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const currentTime = new Date(targetDate)
        currentTime.setHours(hour, minute, 0, 0)
        timePoints.push({ date: currentTime, dateStr })
      }
    }
  }

  // Sort time points for efficient processing
  timePoints.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Calculate moving averages efficiently using sliding window approach
  let entryIndex = 0
  const windowEntries: Array<{ timestamp: Date; bgValue: number }> = []

  for (const timePoint of timePoints) {
    const windowStart = new Date(
      timePoint.date.getTime() - windowHours * 60 * 60 * 1000,
    )

    // Add new entries to window
    while (
      entryIndex < sensorBgEntries.length &&
      sensorBgEntries[entryIndex].timestamp <= timePoint.date
    ) {
      windowEntries.push({
        timestamp: sensorBgEntries[entryIndex].timestamp,
        bgValue: sensorBgEntries[entryIndex].bgValue,
      })
      entryIndex++
    }

    // Remove old entries from window
    while (
      windowEntries.length > 0 &&
      windowEntries[0].timestamp < windowStart
    ) {
      windowEntries.shift()
    }

    if (windowEntries.length > 0) {
      const average =
        windowEntries.reduce((sum, entry) => sum + entry.bgValue, 0) /
        windowEntries.length

      if (!movingAveragesByDate.has(timePoint.dateStr)) {
        movingAveragesByDate.set(timePoint.dateStr, [])
      }

      movingAveragesByDate.get(timePoint.dateStr)!.push({
        timestamp: new Date(timePoint.date),
        value: average,
      })
    }
  }

  return movingAveragesByDate
}
