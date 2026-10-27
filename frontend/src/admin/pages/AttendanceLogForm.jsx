import FormView from '../components/FormView'
import attendanceLogDoctype from '../doctypes/attendanceLog.doctype'
import { create, update, remove, get as getDoc } from '../data/repository'

export default function AttendanceLogForm({ name, isNew, onSaved }) {
  async function prepareDoc(doc) {
    const employee_id = String(doc.employee_id || '').trim()
    const date = String(doc.date || '').trim()
    if (!employee_id) throw new Error('Employee ID is required')
    if (!date) throw new Error('Date is required')

    const employee = await getDoc('employee', employee_id)
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

  const presetDate = new URLSearchParams(window.location.search).get('date') || ''

  return (
    <FormView
      meta={attendanceLogDoctype}
      name={name}
      isNew={isNew}
      initialOverrides={isNew && presetDate ? { date: presetDate } : {}}
      basePath="/attendance-log"
      prepareDoc={prepareDoc}
      onSave={async (doc, { isNew: creating }) => {
        if (creating) await create('attendance_log', doc)
        else await update('attendance_log', name, doc)
        onSaved?.()
      }}
      onDelete={async (id) => {
        await remove('attendance_log', id)
        onSaved?.()
      }}
    />
  )
}
