import {
  Fragment,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { LogEntry } from '../parse'
import { formatDate } from '../formatDate'

/** calculate moving average for all dates at once */
function calculateAllMovingAverages(
  allEntries: LogEntry[],
  windowHours: number = 24,
): Map<string, Array<{ timestamp: Date; value: number }>> {
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

  const movingAveragesByDate = new Map<
    string,
    Array<{ timestamp: Date; value: number }>
  >()

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

const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function DayOfWeek({ date }: { date: string }): ReactNode {
  const day = new Date(date).getDay()
  return (
    <span className={day === 0 || day === 6 ? 'text-red-900' : ''}>
      {dayOfWeek[day]}
    </span>
  )
}

const H = 140

function VisualizerOnDate({
  entries,
  movingAverageData = [],
}: {
  entries: LogEntry[]
  movingAverageData?: Array<{ timestamp: Date; value: number }>
}): ReactNode {
  const dummyRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  const [bgInfoOnCursor, setBgInfoOnCursor] = useState<{
    x: number
    y: number
    sensorBg?: Extract<LogEntry, { type: 'sensor-bg' }>
    measuredBg?: Extract<LogEntry, { type: 'measured-bg' }>
  }>()

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width)
    })
    observer.observe(dummyRef.current!)
    return () => {
      observer.disconnect()
    }
  }, [])

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const t = (24 * 60 * x) / width
    const sorted = entries
      .filter((e) => e.type === 'sensor-bg' || e.type === 'measured-bg')
      .map((e) => ({
        ...e,
        t: e.timestamp.getHours() * 60 + e.timestamp.getMinutes(),
      }))
      .filter((e) => Math.abs(e.t - t) < 10)
      .sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))
      .slice(0, 3)
    const sensorBg = sorted.find((e) => e.type === 'sensor-bg')
    const measuredBg = sorted.find((e) => e.type === 'measured-bg')

    if (sensorBg !== undefined || measuredBg !== undefined) {
      setBgInfoOnCursor({
        x,
        y,
        sensorBg,
        measuredBg,
      })
    } else {
      setBgInfoOnCursor(undefined)
    }
  }

  const handleMouseLeave = () => {
    setBgInfoOnCursor(undefined)
  }

  return (
    <div>
      <div ref={dummyRef}></div>
      {width !== 0 && (
        <div className="relative">
          <svg
            width={width}
            height={H}
            className="cursor-default"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <rect
              x={0}
              y={H * (1 - 250 / 400)}
              width={width}
              height={H * ((250 - 80) / 400)}
              fill="#0a02"
            />
            {[100, 200, 300].map((n) => {
              const y = H * (1 - n / 400)
              return (
                <line key={n} x1={0} y1={y} x2={width} y2={y} stroke="#ccc" />
              )
            })}
            {[...new Array(23)].map((_, i) => {
              const x = width * ((i + 1) / 24)
              return (
                <Fragment key={i}>
                  <line x1={x} y1={0} x2={x} y2={H} stroke="#ccc" />
                  <text x={x + 4} y={12} fontSize={11} fill="#999">
                    {i + 1}
                  </text>
                </Fragment>
              )
            })}
            <rect
              x={0.5}
              y={0.5}
              width={width - 1}
              height={H - 1}
              stroke="#000"
              fill="none"
            />

            {/* 移動平均線を描画 */}
            {movingAverageData.length > 1 && (
              <polyline
                points={movingAverageData
                  .map((point) => {
                    const x =
                      (width *
                        (point.timestamp.getHours() * 60 +
                          point.timestamp.getMinutes())) /
                      (24 * 60)
                    const y = H * (1 - point.value / 400)
                    return `${x},${y}`
                  })
                  .join(' ')}
                stroke="#ff6600"
                strokeWidth="2"
                fill="none"
                opacity="0.8"
              />
            )}

            {entries.map((entry, i) => {
              const d = entry.timestamp
              const x =
                (width * (d.getHours() * 60 + d.getMinutes())) / (24 * 60)
              if (entry.type === 'sensor-bg') {
                const y = H * (1 - entry.bgValue / 400)
                return <circle key={i} cx={x} cy={y} r={2} fill="#88d" />
              }
              if (entry.type === 'measured-bg') {
                const y = H * (1 - entry.bgValue / 400)
                return <circle key={i} cx={x} cy={y} r={3} fill="#07f" />
              }
              if (entry.type === 'bolus') {
                const h = Math.max(entry.amountUnit * 10, 4)
                return (
                  <rect
                    x={x - 2}
                    y={H - h - 1}
                    width={4}
                    height={h}
                    fill="#c00"
                  />
                )
              }

              return null
            })}
          </svg>
          {bgInfoOnCursor && (
            <div
              className="absolute bg-white p-1 opacity-75"
              style={{
                left: bgInfoOnCursor.x + 10,
                top: bgInfoOnCursor.y - 10,
              }}
            >
              {bgInfoOnCursor.sensorBg !== undefined && (
                <div>
                  sensor: {bgInfoOnCursor.sensorBg.bgValue}mg/dL (
                  {getShortTime(bgInfoOnCursor.sensorBg.timestamp)})
                </div>
              )}
              {bgInfoOnCursor.measuredBg !== undefined && (
                <div>
                  measured: {bgInfoOnCursor.measuredBg.bgValue}mg/dL (
                  {getShortTime(bgInfoOnCursor.measuredBg.timestamp)})
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getShortTime(date: Date): string {
  return formatDate(date, 'time').slice(0, 5)
}
