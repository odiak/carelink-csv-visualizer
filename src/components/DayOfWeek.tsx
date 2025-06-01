import { ReactNode } from 'react'

const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function DayOfWeek({ date }: { date: string }): ReactNode {
  const day = new Date(date).getDay()
  return (
    <span className={day === 0 || day === 6 ? 'text-red-900' : ''}>
      {dayOfWeek[day]}
    </span>
  )
}
