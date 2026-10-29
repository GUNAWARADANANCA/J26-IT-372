import { useState } from 'react'
import Button from '@mui/material/Button'
import ListView from '../components/ListView'
import employeeDoctype from '../doctypes/employee.doctype'
import AIProductivityCoachDialog from '../ui/AIProductivityCoachDialog'
import EmployeeOverviewPanel from './EmployeeOverviewPanel'

export default function EmployeeList({ refreshKey }) {
  const [coachId, setCoachId] = useState('')
  return (
    <>
      <EmployeeOverviewPanel refreshKey={refreshKey} />
      <ListView
        meta={employeeDoctype}
        basePath="/employee"
        refreshKey={refreshKey}
        canDelete
        renderActions={(row) => (
          <Button
            size="small"
            variant="outlined"
            onClick={() => setCoachId(row.employee_id || row.name)}
          >
            Generate Recommendation
          </Button>
        )}
      />
      <AIProductivityCoachDialog
        open={Boolean(coachId)}
        employeeId={coachId}
        onClose={() => setCoachId('')}
      />
    </>
  )
}
