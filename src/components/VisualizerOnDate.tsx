import { Fragment, ReactNode, useEffect, useRef, useState } from 'react'
import { LogEntry } from '../parse'
import { getShortTime } from '../utils/timeFormat'
import { MovingAveragePoint } from '../utils/movingAverage'
import { ClickedBgData } from './Visualizer'

const H = 140

export function VisualizerOnDate({
  entries,
  movingAverageData = [],
  onBgDataClick,
  clickedDataForDate = [],
}: {
  entries: LogEntry[]
  movingAverageData?: MovingAveragePoint[]
  clickedDataForDate?: ClickedBgData[]
  onBgDataClick?: (
    sensorBg?: Extract<LogEntry, { type: 'sensor-bg' }>,
    measuredBg?: Extract<LogEntry, { type: 'measured-bg' }>,
  ) => void
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

  const handleClick = (e: React.MouseEvent<unknown>) => {
    if (bgInfoOnCursor && e.shiftKey) {
      onBgDataClick?.(bgInfoOnCursor.sensorBg, bgInfoOnCursor.measuredBg)
      e.preventDefault()
    }
  }

  // Helper function to check if a data point is clicked
  const isDataPointClicked = (entry: LogEntry) => {
    const entryTime =
      entry.timestamp.getHours().toString().padStart(2, '0') +
      ':' +
      entry.timestamp.getMinutes().toString().padStart(2, '0')
    return clickedDataForDate.some((clicked) => {
      if (
        entry.type === 'sensor-bg' &&
        clicked.sensorBgValue &&
        clicked.sensorBgTime
      ) {
        return (
          entry.bgValue === clicked.sensorBgValue &&
          entryTime === clicked.sensorBgTime
        )
      }
      if (
        entry.type === 'measured-bg' &&
        clicked.remoteBgValue &&
        clicked.remoteBgTime
      ) {
        return (
          entry.bgValue === clicked.remoteBgValue &&
          entryTime === clicked.remoteBgTime
        )
      }
      return false
    })
  }

  return (
    <div className="select-none">
      <div ref={dummyRef}></div>
      {width !== 0 && (
        <div className="relative">
          <svg
            width={width}
            height={H}
            className="cursor-default"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
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
              const isClicked = isDataPointClicked(entry)

              if (entry.type === 'sensor-bg') {
                const y = H * (1 - entry.bgValue / 400)
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={2} fill="#88d" />
                    {isClicked && (
                      <circle
                        cx={x}
                        cy={y}
                        r={4}
                        fill="none"
                        stroke="#f008"
                        strokeWidth={2}
                      />
                    )}
                  </g>
                )
              }
              if (entry.type === 'measured-bg') {
                const y = H * (1 - entry.bgValue / 400)
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={3} fill="#07f" />
                    {isClicked && (
                      <circle
                        cx={x}
                        cy={y}
                        r={5}
                        fill="none"
                        stroke="#f008"
                        strokeWidth={2}
                      />
                    )}
                  </g>
                )
              }
              if (entry.type === 'bolus') {
                const h = Math.max(entry.amountUnit * 10, 4)
                return (
                  <rect
                    key={i}
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
              className="absolute bg-white p-1 opacity-75 cursor-pointer border border-gray-300 rounded"
              style={{
                left: bgInfoOnCursor.x + 10,
                top: bgInfoOnCursor.y - 10,
              }}
              onClick={() =>
                onBgDataClick?.(
                  bgInfoOnCursor.sensorBg,
                  bgInfoOnCursor.measuredBg,
                )
              }
              title="Click to add to list"
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
