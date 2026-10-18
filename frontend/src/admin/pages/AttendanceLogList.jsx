import ListView from '../components/ListView'
import attendanceLogDoctype from '../doctypes/attendanceLog.doctype'

export default function AttendanceLogList({ refreshKey }) {
  return (
    <ListView
      meta={attendanceLogDoctype}
      basePath="/attendance-log"
      refreshKey={refreshKey}
    />
  )
}
