import FormView from '../components/FormView'
import employeeDoctype from '../doctypes/employee.doctype'
import { computeEmployeeFields } from '../data/computeKpi'
import { create, update, remove } from '../data/repository'

export default function EmployeeForm({ name, isNew, onSaved }) {
  function prepareDoc(doc) {
    const computed = computeEmployeeFields(doc)
    const employee_id = String(computed.employee_id || '').trim()
    if (!employee_id) throw new Error('Employee ID is required')
    return {
      ...computed,
      employee_id,
      name: employee_id,
    }
  }

  return (
    <FormView
      meta={employeeDoctype}
      name={name}
      isNew={isNew}
      basePath="/employee"
      prepareDoc={prepareDoc}
      onSave={async (doc, { isNew: creating }) => {
        if (creating) await create('employee', doc)
        else await update('employee', name, doc)
        onSaved?.()
      }}
      onDelete={async (id) => {
        await remove('employee', id)
        onSaved?.()
      }}
    />
  )
}
