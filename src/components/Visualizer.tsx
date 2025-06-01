import { ReactNode, useMemo, useState } from 'react'
import { LogEntry } from '../parse'
import { formatDate } from '../formatDate'
import { calculateAllMovingAverages } from '../utils/movingAverage'
import { DayOfWeek } from './DayOfWeek'
import { VisualizerOnDate } from './VisualizerOnDate'

/** Clicked BG data */
export type ClickedBgData = {
  id: string
  date: string
  sensorBgTime?: string
  sensorBgValue?: number
  remoteBgTime?: string
  remoteBgValue?: number
}

export function Visualizer({ entries }: { entries: LogEntry[] }): ReactNode {
  const [showMovingAverage, setShowMovingAverage] = useState(false)
  const [clickedDataList, setClickedDataList] = useState<ClickedBgData[]>([])

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

  // Add clicked data to the list
  const handleBgDataClick = (data: {
    date: string
    sensorBg?: Extract<LogEntry, { type: 'sensor-bg' }>
    measuredBg?: Extract<LogEntry, { type: 'measured-bg' }>
  }) => {
    const newData: ClickedBgData = {
      id: `${data.date}-${Date.now()}-${Math.random()}`,
      date: data.date,
      sensorBgTime: data.sensorBg
        ? formatDate(data.sensorBg.timestamp, 'time').slice(0, 5)
        : undefined,
      sensorBgValue: data.sensorBg?.bgValue,
      remoteBgTime: data.measuredBg
        ? formatDate(data.measuredBg.timestamp, 'time').slice(0, 5)
        : undefined,
      remoteBgValue: data.measuredBg?.bgValue,
    }
    setClickedDataList((prev) => [...prev, newData])
  }

  // Remove item from list
  const handleRemoveData = (id: string) => {
    setClickedDataList((prev) => prev.filter((item) => item.id !== id))
  }

  // Group by date and sort by time
  const groupedData = useMemo(() => {
    const groups = new Map<string, ClickedBgData[]>()
    for (const item of clickedDataList) {
      if (!groups.has(item.date)) {
        groups.set(item.date, [])
      }
      groups.get(item.date)!.push(item)
    }

    // Sort items within each group by time
    for (const [, items] of groups) {
      items.sort((a, b) => {
        const timeA = a.sensorBgTime ?? a.remoteBgTime ?? '00:00'
        const timeB = b.sensorBgTime ?? b.remoteBgTime ?? '00:00'
        return timeA.localeCompare(timeB)
      })
    }

    return groups
  }, [clickedDataList])

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
              onBgDataClick={(sensorBg, measuredBg) =>
                handleBgDataClick({ date: dateString, sensorBg, measuredBg })
              }
            />
          </div>
        )
      })}

      {/* Fixed list displayed at the bottom right */}
      {clickedDataList.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-md max-h-96 overflow-y-auto z-50">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-lg mr-3 my-0">Clicked BG Data</h4>
            <button
              onClick={() => setClickedDataList([])}
              className="text-gray-500 hover:text-gray-700 text-xs"
            >
              Clear All
            </button>
          </div>

          {Array.from(groupedData.entries())
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB)) // 古い日付順
            .map(([date, items]) => (
              <div key={date} className="mb-4">
                <h5 className="font-semibold text-sm text-gray-700 mt-0 mb-2">
                  {date}
                </h5>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 p-2 rounded mb-2 text-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        {item.sensorBgTime && item.sensorBgValue && (
                          <div>
                            Sensor: {item.sensorBgValue}mg/dL (
                            {item.sensorBgTime})
                          </div>
                        )}
                        {item.remoteBgTime && item.remoteBgValue && (
                          <div>
                            Remote: {item.remoteBgValue}mg/dL (
                            {item.remoteBgTime})
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveData(item.id)}
                        className="text-red-500 hover:text-red-700 ml-2"
                        title="Remove"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
