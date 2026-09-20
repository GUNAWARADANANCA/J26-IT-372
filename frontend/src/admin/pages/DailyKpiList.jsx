import ListView from '../components/ListView'
import dailyKpiLogDoctype from '../doctypes/dailyKpiLog.doctype'

export default function DailyKpiList({ refreshKey }) {
  return (
    <ListView
      meta={dailyKpiLogDoctype}
      basePath="/daily-kpi-log"
      refreshKey={refreshKey}
    />
  )
}
