import styles from './ActivityHeatmap.module.css'

// data: { 'YYYY-MM-DD': count }
// Renders the last ~26 weeks as a GitHub-style contribution grid.
export default function ActivityHeatmap({ data, weeks = 26 }) {
  const today = new Date()
  const days = []
  const totalDays = weeks * 7

  // Build backwards from today so the grid always ends "now"
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ date: key, count: data[key] || 0 })
  }

  // Group into columns of 7 (weeks), starting on Sunday
  const firstDay = new Date(days[0].date)
  const leadingBlanks = firstDay.getDay()
  const padded = [...Array(leadingBlanks).fill(null), ...days]
  const columns = []
  for (let i = 0; i < padded.length; i += 7) {
    columns.push(padded.slice(i, i + 7))
  }

  function levelFor(count) {
    if (count === 0) return 0
    if (count === 1) return 1
    if (count <= 3) return 2
    if (count <= 6) return 3
    return 4
  }

  const monthLabels = []
  let lastMonth = null
  columns.forEach((col, i) => {
    const firstReal = col.find(d => d !== null)
    if (!firstReal) { monthLabels.push(''); return }
    const month = new Date(firstReal.date).toLocaleDateString('en-US', { month: 'short' })
    if (month !== lastMonth) {
      monthLabels.push(month)
      lastMonth = month
    } else {
      monthLabels.push('')
    }
  })

  return (
    <div className={styles.wrap}>
      <div className={styles.months}>
        {monthLabels.map((m, i) => (
          <span key={i} className={styles.monthLabel}>{m}</span>
        ))}
      </div>
      <div className={styles.grid}>
        {columns.map((col, ci) => (
          <div key={ci} className={styles.col}>
            {col.map((day, di) => (
              day ? (
                <div
                  key={di}
                  className={styles.cell}
                  data-level={levelFor(day.count)}
                  title={`${day.count} ${day.count === 1 ? 'activity' : 'activities'} on ${day.date}`}
                />
              ) : (
                <div key={di} className={styles.cellBlank} />
              )
            ))}
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        <span>Less</span>
        {[0, 1, 2, 3, 4].map(l => (
          <div key={l} className={styles.cell} data-level={l} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
