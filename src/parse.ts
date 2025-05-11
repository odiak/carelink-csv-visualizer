export type LogEntry = {
  timestamp: Date
} & (
  | {
      type: 'sensor-bg'
      bgValue: number
    }
  | {
      type: 'bolus'
      amountUnit: number
      carbGrams?: number
    }
  | {
      type: 'measured-bg'
      bgValue: number
    }
)

const validLinePattern = /^\d+\.\d+/

const columns = {
  // Index,Date,Time,New Device Time,BG Source,BG Reading (mg/dL),Linked BG Meter ID,Basal Rate (U/h),Temp Basal Amount,Temp Basal Type,Temp Basal Duration (h:mm:ss),Bolus Type,Bolus Volume Selected (U),Bolus Volume Delivered (U),Bolus Duration (h:mm:ss),Prime Type,Prime Volume Delivered (U),Estimated Reservoir Volume after Fill (U),Alert,User Cleared Alerts,Suspend,Rewind,BWZ Estimate (U),BWZ Target High BG (mg/dL),BWZ Target Low BG (mg/dL),BWZ Carb Ratio (g/U),BWZ Insulin Sensitivity (mg/dL/U),BWZ Carb Input (grams),BWZ BG Input (mg/dL),BWZ Correction Estimate (U),BWZ Food Estimate (U),BWZ Active Insulin (U),BWZ Status,Sensor Calibration BG (mg/dL),Sensor Glucose (mg/dL),ISIG Value,Event Marker,Bolus Number,Bolus Cancellation Reason,BWZ Unabsorbed Insulin Total (U),Final Bolus Estimate,Scroll Step Size,Insulin Action Curve Time,Sensor Calibration Rejected Reason,Preset Bolus,Bolus Source,BLE Network Device,Device Update Event,Network Device Associated Reason,Network Device Disassociated Reason,Network Device Disconnected Reason,Sensor Exception,Preset Temp Basal Name
  Date: 1,
  Time: 2,
  'New Device Time': 3,
  'BG Source': 4,
  'BG Reading (mg/dL)': 5,
  'Linked BG Meter ID': 6,
  'Basal Rate (U/h)': 7,
  'Temp Basal Amount': 8,
  'Temp Basal Type': 9,
  'Temp Basal Duration (h:mm:ss)': 10,
  'Bolus Type': 11,
  'Bolus Volume Selected (U)': 12,
  'Bolus Volume Delivered (U)': 13,
  'Bolus Duration (h:mm:ss)': 14,
  'Prime Type': 15,
  'Prime Volume Delivered (U)': 16,
  'Estimated Reservoir Volume after Fill (U)': 17,
  Alert: 18,
  'User Cleared Alerts': 19,
  Suspend: 20,
  Rewind: 21,
  'BWZ Estimate (U)': 22,
  'BWZ Target High BG (mg/dL)': 23,
  'BWZ Target Low BG (mg/dL)': 24,
  'BWZ Carb Ratio (g/U)': 25,
  'BWZ Insulin Sensitivity (mg/dL/U)': 26,
  'BWZ Carb Input (grams)': 27,
  'BWZ BG Input (mg/dL)': 28,
  'BWZ Correction Estimate (U)': 29,
  'BWZ Food Estimate (U)': 30,
  'BWZ Active Insulin (U)': 31,
  'BWZ Status': 32,
  'Sensor Calibration BG (mg/dL)': 33,
  'Sensor Glucose (mg/dL)': 34,
  'ISIG Value': 35,
  'Event Marker': 36,
  'Bolus Number': 37,
  'Bolus Cancellation Reason': 38,
  'BWZ Unabsorbed Insulin Total (U)': 39,
  'Final Bolus Estimate': 40,
  'Scroll Step Size': 41,
  'Insulin Action Curve Time': 42,
  'Sensor Calibration Rejected Reason': 43,
  'Preset Bolus': 44,
  'Bolus Source': 45,
  'BLE Network Device': 46,
  'Device Update Event': 47,
  'Network Device Associated Reason': 48,
  'Network Device Disassociated Reason': 49,
  'Network Device Disconnected Reason': 50,
  'Sensor Exception': 51,
  'Preset Temp Basal Name': 52,
} as const
export type RawRecord = Record<keyof typeof columns, string | undefined> & {
  _timestamp: Date
}

export async function parseFile(
  file: File,
): Promise<[LogEntry[], RawRecord[]]> {
  const rawRecords: RawRecord[] = []
  const entries: LogEntry[] = []
  for await (const line of getLines(file)) {
    if (!validLinePattern.test(line)) continue

    const rawRecord = parseLine(line)
    rawRecords.push(rawRecord)
  }

  rawRecords.sort((a, b) => {
    return b._timestamp.getTime() - a._timestamp.getTime()
  })

  for (const [i, rawRecord] of rawRecords.entries()) {
    const timestamp = rawRecord._timestamp

    if (rawRecord['Sensor Glucose (mg/dL)'] !== undefined) {
      entries.push({
        type: 'sensor-bg',
        bgValue: Number(rawRecord['Sensor Glucose (mg/dL)']),
        timestamp,
      })
      continue
    }
    if (
      rawRecord['Bolus Volume Selected (U)'] !== undefined &&
      rawRecord['Bolus Volume Delivered (U)'] === undefined
    ) {
      let carbGrams: number | undefined
      const next = rawRecords[i + 1]
      if (next !== undefined && next['BWZ Carb Input (grams)'] !== undefined) {
        carbGrams = Number(next['BWZ Carb Input (grams)'])
      }
      entries.push({
        type: 'bolus',
        amountUnit: Number(rawRecord['Bolus Volume Selected (U)']),
        carbGrams,
        timestamp,
      })
      continue
    }
    if (
      rawRecord['BG Source'] === 'USER_ACCEPTED_REMOTE_BG' || // sent from measurement device
      rawRecord['BG Source'] === 'ENTERED_IN_BG_ENTRY' // manually entered
    ) {
      entries.push({
        type: 'measured-bg',
        bgValue: Number(rawRecord['BG Reading (mg/dL)']),
        timestamp,
      })
    }
  }

  return [entries, rawRecords]
}

function parseLine(line: string): RawRecord {
  // Parse a line like CSV. It may contains quotes
  // example: 123.456,"789.012","A,B,C"

  const values: string[] = []
  let i = 0

  const skipWhitespace = () => {
    while (i < line.length && line[i] === ' ') i++
  }

  while (i < line.length) {
    skipWhitespace()
    if (line[i] === '"') {
      i++
      const j = line.indexOf('"', i)
      if (j === -1) {
        throw new Error('Unclosed quote')
      }
      values.push(line.slice(i, j))
      i = j + 1
      skipWhitespace()
      if (i < line.length && line[i] !== ',') {
        throw new Error('Expected comma')
      }
      i++
    } else {
      const j = line.indexOf(',', i)
      if (j === -1) {
        values.push(line.slice(i).trim())
        break
      }
      values.push(line.slice(i, j))
      i = j + 1
    }
  }

  const record: Record<string, string | undefined> = {}
  for (const [key, index] of Object.entries(columns)) {
    const v = values[index]
    if (v !== '') {
      record[key] = v
    }
  }

  const r = record as RawRecord
  r._timestamp = new Date(`${record['Date']} ${record['Time']}`)

  return r
}

async function* getLines(file: File): AsyncGenerator<string> {
  const stream = file.stream()
  const decoderStream = new TextDecoderStream()
  stream.pipeTo(decoderStream.writable)
  const reader = decoderStream.readable.getReader()

  let remaining = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    let i = 0
    while (i < value.length) {
      const j = value.indexOf('\n', i)
      if (j === -1) {
        remaining = value.slice(i)
        break
      }
      const line = value.slice(i, j)
      if (i === 0 && remaining) {
        yield remaining + line
        remaining = ''
      } else {
        yield line
      }
      i = j + 1
    }
  }
}
