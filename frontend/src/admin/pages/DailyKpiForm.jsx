import FormView from '../components/FormView'
import dailyKpiLogDoctype from '../doctypes/dailyKpiLog.doctype'
import { computeDailyKpiFields } from '../data/computeKpi'
import { create, update, remove } from '../data/repository'

export default function DailyKpiForm({ name, isNew, onSaved }) {
  function prepareDoc(doc) {
    const computed = computeDailyKpiFields(doc)
    const employee_id = String(computed.employee_id || '').trim()
    const date = String(computed.date || '').trim()
    if (!employee_id) throw new Error('Employee is required')
    if (!date) throw new Error('Date is required')
    return {
      ...computed,
      employee_id,
      date,
      name: `${employee_id}-${date}`,
    }
  }

  return (
    <FormView
      meta={dailyKpiLogDoctype}
      name={name}
      isNew={isNew}
      basePath="/daily-kpi-log"
      prepareDoc={prepareDoc}
      onSave={async (doc, { isNew: creating }) => {
        if (creating) await create('daily_kpi_log', doc)
        else await update('daily_kpi_log', name, doc)
        onSaved?.()
      }}
      onDelete={async (id) => {
        await remove('daily_kpi_log', id)
        onSaved?.()
      }}
    />
  )
}
