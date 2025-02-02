import { ReactNode, useMemo, useState } from 'react'
import { RawRecord } from '../parse'

export function RawLog({ rawRecords }: { rawRecords: RawRecord[] }): ReactNode {
  const [dateIndex, setDateIndex] = useState(0)
  const dates = useMemo(() => {
    return Array.from(new Set(rawRecords.map((record) => record.Date!)))
  }, [rawRecords])

  return (
    <div>
      <div>
        <button
          onClick={() => setDateIndex(dateIndex - 1)}
          disabled={dateIndex === 0}
        >
          &lt;
        </button>
        {dates[dateIndex]}
        <button
          onClick={() => setDateIndex(dateIndex + 1)}
          disabled={dateIndex >= dates.length - 1}
        >
          &gt;
        </button>
      </div>
      <ul>
        {rawRecords
          .filter((record) => record.Date === dates[dateIndex])
          .map((record, i) => (
            <li key={i} className="mt-4">
              <div>
                {record.Date} {record.Time}
              </div>
              {Object.entries(record)
                .filter(
                  ([k]) => k !== 'Date' && k !== 'Time' && k !== '_timestamp',
                )
                .map(([k, v]) => (
                  <div key={k}>
                    <span className="text-gray-500 font-bold">{k}</span>:{' '}
                    {v as string}
                  </div>
                ))}
            </li>
          ))}
      </ul>
    </div>
  )
}
