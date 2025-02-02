import { ReactNode, useState, useEffect, ChangeEvent } from 'react'
import { parseFile, LogEntry, RawRecord } from './parse'
import { RawLog } from './components/RawLog'
import { Visualizer } from './components/Visualizer'

export function App(): ReactNode {
  const [fileName, setFileName] = useState<string>()
  const [entries, setEntries] = useState<LogEntry[]>()
  const [rawRecords, setRawRecords] = useState<RawRecord[]>()

  const [showRawLog, setShowRawLog] = useState(false)

  const handleFile = async (file: File) => {
    setFileName(file.name)

    const [entries, rawRecords] = await parseFile(file)
    setEntries(entries)
    setRawRecords(rawRecords)
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()

    const file = e.dataTransfer?.files[0]
    if (file !== undefined) {
      handleFile(file)
    }
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file !== undefined) {
      await handleFile(file)
    }
  }

  useEffect(() => {
    const handleBodyDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleBodyDrop = (e: DragEvent) => {
      e.preventDefault()
      handleDrop(e)
    }

    document.body.addEventListener('dragover', handleBodyDragOver)
    document.body.addEventListener('drop', handleBodyDrop)

    return () => {
      document.body.removeEventListener('dragover', handleBodyDragOver)
      document.body.removeEventListener('drop', handleBodyDrop)
    }
  }, [])

  return (
    <div className="mx-auto max-w-[1000px] p-3">
      <h1 className="text-2xl font-bold">Carelink CSV Visualizer</h1>
      <div className="mt-5 border-2 border-dashed border-gray-300 rounded-lg p-5 text-center">
        Drop CSV file here
        <br />
        <input className="mt-2" type="file" onChange={handleFileChange} />
      </div>
      {fileName && (
        <div>
          <p className="mt-5">file: {fileName}</p>
          <label>
            <input
              type="checkbox"
              checked={showRawLog}
              onChange={() => setShowRawLog(!showRawLog)}
            />
            Show raw data
          </label>
        </div>
      )}
      {!showRawLog && entries !== undefined && (
        <div className="mt-5">
          <h2 className="text-xl font-bold">Entries</h2>
          <Visualizer entries={entries} />
        </div>
      )}
      {showRawLog && rawRecords !== undefined && (
        <div className="mt-5">
          <h2 className="text-xl font-bold">Raw Log</h2>
          <RawLog rawRecords={rawRecords} />
        </div>
      )}
    </div>
  )
}
