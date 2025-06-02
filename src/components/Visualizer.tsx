import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { LogEntry } from '../parse'
import { formatDate } from '../utils/formatDate'
import { calculateAllMovingAverages } from '../utils/movingAverage'
import { DayOfWeek } from './DayOfWeek'
import { VisualizerOnDate } from './VisualizerOnDate'

/** Clicked BG data */
export type ClickedBgData = {
  id: string
  date: string
  sensorBgTime?: Date
  sensorBgValue?: number
  remoteBgTime?: Date
  remoteBgValue?: number
}

export function Visualizer({ entries }: { entries: LogEntry[] }): ReactNode {
  const [showMovingAverage, setShowMovingAverage] = useState(false)
  const [clickedDataList, setClickedDataList] = useState<ClickedBgData[]>([])

  const dummyRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

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
    // Check if this data already exists in the list
    const existingDataIndex = clickedDataList.findIndex((item) => {
      const isSameDate = item.date === data.date

      // Check sensor BG match
      const sensorMatch =
        data.sensorBg && item.sensorBgValue && item.sensorBgTime
          ? item.sensorBgValue === data.sensorBg.bgValue &&
            item.sensorBgTime?.getTime() === data.sensorBg.timestamp.getTime()
          : !data.sensorBg && !item.sensorBgValue

      // Check measured BG match
      const measuredMatch =
        data.measuredBg && item.remoteBgValue && item.remoteBgTime
          ? item.remoteBgValue === data.measuredBg.bgValue &&
            item.remoteBgTime?.getTime() === data.measuredBg.timestamp.getTime()
          : !data.measuredBg && !item.remoteBgValue

      return isSameDate && sensorMatch && measuredMatch
    })

    if (existingDataIndex !== -1) {
      // Data exists, remove it
      setClickedDataList((prev) =>
        prev.filter((_, index) => index !== existingDataIndex),
      )
    } else {
      // Data doesn't exist, add it
      const newData: ClickedBgData = {
        id: `${data.date}-${Date.now()}-${Math.random()}`,
        date: data.date,
        sensorBgTime: data.sensorBg?.timestamp,
        sensorBgValue: data.sensorBg?.bgValue,
        remoteBgTime: data.measuredBg?.timestamp,
        remoteBgValue: data.measuredBg?.bgValue,
      }
      setClickedDataList((prev) => [...prev, newData])
    }
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
        const ta = (a.sensorBgTime ?? a.remoteBgTime)?.getTime() ?? 0
        const tb = (b.sensorBgTime ?? b.remoteBgTime)?.getTime() ?? 0
        return ta - tb
      })
    }

    return groups
  }, [clickedDataList])

  useEffect(() => {
    if (dummyRef.current) {
      const observer = new ResizeObserver((entries) => {
        setWidth(entries[0].contentRect.width)
      })
      observer.observe(dummyRef.current)
      return () => {
        observer.disconnect()
      }
    }
  }, [])

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

      <div ref={dummyRef} />

      {width !== 0 &&
        Array.from(entriesByDate.entries()).map(([dateString, dateEntries]) => {
          const movingAverageData = allMovingAverages.get(dateString) || []
          const clickedDataForDate = clickedDataList.filter(
            (data) => data.date === dateString,
          )

          return (
            <div key={dateString} className="mt-10">
              <h3>
                {dateString} <DayOfWeek date={dateString} />
              </h3>
              <VisualizerOnDate
                entries={dateEntries}
                width={width}
                height={140}
                movingAverageData={movingAverageData}
                clickedDataForDate={clickedDataForDate}
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
                            {formatDate(item.sensorBgTime, 'time')})
                          </div>
                        )}
                        {item.remoteBgTime && item.remoteBgValue && (
                          <div>
                            Remote: {item.remoteBgValue}mg/dL (
                            {formatDate(item.remoteBgTime, 'time')})
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
