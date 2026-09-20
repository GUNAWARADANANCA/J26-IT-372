import FormView from '../components/FormView'
import attendanceLogDoctype from '../doctypes/attendanceLog.doctype'
import { create, update, remove, get as getDoc } from '../data/repository'

export default function AttendanceLogForm({ name, isNew, onSaved }) {
  function prepareDoc(doc) {
    const employee_id = String(doc.employee_id || '').trim()
    const date = String(doc.date || '').trim()
    if (!employee_id) throw new Error('Employee ID is required')
    if (!date) throw new Error('Date is required')
    if (!doc.fingerprint_in) throw new Error('Fingerprint In is required')

    const employee = getDoc('employee', employee_id)
    return {
      ...doc,
      employee_id,
      date,
      employee_name: employee?.employee_name || doc.employee_name || '',
      post_office: employee?.post_office || doc.post_office || '',
      designation: employee?.designation || doc.designation || '',
      name: `${employee_id}-${date}`,
    }
  }

  return (
    <FormView
      meta={attendanceLogDoctype}
      name={name}
      isNew={isNew}
      basePath="/attendance-log"
      prepareDoc={prepareDoc}
      onSave={(doc, { isNew: creating }) => {
        if (creating) create('attendance_log', doc)
        else update('attendance_log', name, doc)
        onSaved?.()
      }}
      onDelete={(id) => {
        remove('attendance_log', id)
        onSaved?.()
      }}
    />
  )
}
