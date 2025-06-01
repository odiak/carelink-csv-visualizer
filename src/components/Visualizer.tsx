import { ReactNode, useMemo, useState } from 'react'
import { LogEntry } from '../parse'
import { formatDate } from '../formatDate'
import { calculateAllMovingAverages } from '../utils/movingAverage'
import { DayOfWeek } from './DayOfWeek'
import { VisualizerOnDate } from './VisualizerOnDate'

export function Visualizer({ entries }: { entries: LogEntry[] }): ReactNode {
  const [showMovingAverage, setShowMovingAverage] = useState(false)

  const entriesByDate = useMemo(() => {
    const map = new Map<string, LogEntry[]>()
    let dateString = ''
    let y = 0,
      m = 0,
      d = 0
    let subEntries: LogEntry[] = []
    for (const entry of entries) {
      const date = entry.timestamp
      if (
        y !== date.getFullYear() ||
        m !== date.getMonth() ||
        d !== date.getDate()
      ) {
        y = date.getFullYear()
        m = date.getMonth()
        d = date.getDate()
        dateString = formatDate(date, 'date')
        subEntries = []
        map.set(dateString, subEntries)
      }
      subEntries.push(entry)
    }
    return map
  }, [entries])

  // Calculate all moving averages at once when showMovingAverage is enabled
  const allMovingAverages = useMemo(() => {
    if (!showMovingAverage) return new Map()
    return calculateAllMovingAverages(entries)
  }, [entries, showMovingAverage])

  return (
    <div>
      <div className="mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showMovingAverage}
            onChange={(e) => setShowMovingAverage(e.target.checked)}
          />
          <span>Show 24-hour blood glucose moving average</span>
        </label>
      </div>
      {Array.from(entriesByDate.entries()).map(([dateString, dateEntries]) => {
        const movingAverageData = allMovingAverages.get(dateString) || []

        return (
          <div key={dateString} className="mt-10">
            <h3>
              {dateString} <DayOfWeek date={dateString} />
            </h3>
            <VisualizerOnDate
              entries={dateEntries}
              movingAverageData={movingAverageData}
            />
          </div>
        )
      })}
    </div>
  )
}
