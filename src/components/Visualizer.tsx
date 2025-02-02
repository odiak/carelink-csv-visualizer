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

export function Visualizer({ entries }: { entries: LogEntry[] }): ReactNode {
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

  return (
    <div>
      {Array.from(entriesByDate.entries()).map(([dateString, entries]) => (
        <div key={dateString} className="mt-10">
          <h3>
            {dateString} <DayOfWeek date={dateString} />
          </h3>
          <VisualizerOnDate entries={entries} />
        </div>
      ))}
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

function VisualizerOnDate({ entries }: { entries: LogEntry[] }): ReactNode {
  const dummyRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  const [bgInfoOnCursor, setBgInfoOnCursor] = useState<{
    x: number
    y: number
    sensorBg?: Extract<LogEntry, { type: 'sensor-bg' }>
    remoteBg?: Extract<LogEntry, { type: 'remote-bg' }>
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
      .filter((e) => e.type === 'sensor-bg' || e.type === 'remote-bg')
      .map((e) => ({
        ...e,
        t: e.timestamp.getHours() * 60 + e.timestamp.getMinutes(),
      }))
      .filter((e) => Math.abs(e.t - t) < 10)
      .sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))
      .slice(0, 3)
    const sensorBg = sorted.find((e) => e.type === 'sensor-bg')
    const remoteBg = sorted.find((e) => e.type === 'remote-bg')

    if (sensorBg !== undefined || remoteBg !== undefined) {
      setBgInfoOnCursor({
        x,
        y,
        sensorBg,
        remoteBg,
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
            {entries.map((entry, i) => {
              const d = entry.timestamp
              const x =
                (width * (d.getHours() * 60 + d.getMinutes())) / (24 * 60)
              if (entry.type === 'sensor-bg') {
                const y = H * (1 - entry.bgValue / 400)
                return <circle key={i} cx={x} cy={y} r={2} fill="#88d" />
              }
              if (entry.type === 'remote-bg') {
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
              {bgInfoOnCursor.remoteBg !== undefined && (
                <div>
                  remote: {bgInfoOnCursor.remoteBg.bgValue}mg/dL (
                  {getShortTime(bgInfoOnCursor.remoteBg.timestamp)})
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
