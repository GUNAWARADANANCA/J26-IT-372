import ListView from '../components/ListView'
import employeeDoctype from '../doctypes/employee.doctype'

export default function EmployeeList({ refreshKey }) {
  return (
    <ListView
      meta={employeeDoctype}
      basePath="/employee"
      refreshKey={refreshKey}
    />
  )
}
