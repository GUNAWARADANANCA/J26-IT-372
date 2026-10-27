import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildEmployeeWorkloadRows,
  calculateWorkloadSummaryCards,
  classifyWorkloadStatus,
  computeAutoBalancePreview,
  generateWorkloadRecommendations,
  validateAllocationForm,
} from './workAllocationHelpers.js'

const SAMPLE_EMPLOYEES = [
  { employee_id: 'EMP1137', employee_name: 'Nuwan Priyantha Fernando', designation: 'Senior Postman', work_category: 'Delivery (Field)', post_office: 'Kaduwela' },
  { employee_id: 'EMP1138', employee_name: 'Sunil Chaminda Perera', designation: 'Postman', work_category: 'Delivery (Field)', post_office: 'Kaduwela' },
  { employee_id: 'EMP1145', employee_name: 'Saman Kumara Liyanage', designation: 'Postman', work_category: 'Delivery (Field)', post_office: 'Kaduwela' },
  { employee_id: 'EMP1150', employee_name: 'Thilini Madhavi Abeysekara', designation: 'Postal Assistant', work_category: 'Office', post_office: 'Kaduwela' },
  { employee_id: 'EMP1151', employee_name: 'Janaka Priyadarshana Ekanayake', designation: 'Postal Clerk', work_category: 'Office', post_office: 'Kaduwela' },
]

const SAMPLE_LOGS = [
  { employee_id: 'EMP1137', date: '2025-01-31', assigned_work_count: 7, completed_work_count: 5, uncompleted_work_count: 2, primary_task_type: 'Mail & Parcel Delivery', route_id: 'R61-NEG', route_length_km: 25 },
  { employee_id: 'EMP1138', date: '2025-01-31', assigned_work_count: 4, completed_work_count: 4, uncompleted_work_count: 0, primary_task_type: 'Mail & Parcel Delivery', route_id: 'R62-NEG', route_length_km: 10 },
  { employee_id: 'EMP1145', date: '2025-01-31', assigned_work_count: 2, completed_work_count: 2, uncompleted_work_count: 0, primary_task_type: 'Mail & Parcel Delivery', route_id: 'R69-NEG', route_length_km: 8 },
  { employee_id: 'EMP1150', date: '2025-01-31', assigned_work_count: 5, completed_work_count: 4, uncompleted_work_count: 1, primary_task_type: 'Workflow Coordination' },
  { employee_id: 'EMP1151', date: '2025-01-31', assigned_work_count: 5, completed_work_count: 5, uncompleted_work_count: 0, primary_task_type: 'Customer Service Counter' },
]

test('classifyWorkloadStatus assigns Balanced, Underutilized, Near Capacity, and Overloaded accurately', () => {
  assert.equal(classifyWorkloadStatus(50).status, 'Underutilized')
  assert.equal(classifyWorkloadStatus(80).status, 'Balanced')
  assert.equal(classifyWorkloadStatus(100).status, 'Near Capacity')
  assert.equal(classifyWorkloadStatus(135).status, 'Overloaded')
})

test('buildEmployeeWorkloadRows and calculateWorkloadSummaryCards compute real metrics for employees', () => {
  const rows = buildEmployeeWorkloadRows({
    employees: SAMPLE_EMPLOYEES,
    allLogs: SAMPLE_LOGS,
    selectedDate: '2025-01-31',
    leaves: [{ employee_id: 'EMP1150', status: 'Approved', from_date: '', to_date: '' }],
  })
  assert.equal(rows.length, 5)
  const emp1137 = rows.find((r) => r.employee_id === 'EMP1137')
  assert.equal(emp1137.assigned_tasks, 7)
  assert.equal(emp1137.completed_tasks, 5)
  assert.equal(emp1137.pending_tasks, 2)
  assert.equal(emp1137.workload_status, 'Overloaded')

  const emp1145 = rows.find((r) => r.employee_id === 'EMP1145')
  assert.equal(emp1145.workload_status, 'Underutilized')

  const emp1150 = rows.find((r) => r.employee_id === 'EMP1150')
  assert.equal(emp1150.on_leave, true)

  const summary = calculateWorkloadSummaryCards(rows)
  assert.equal(summary.totalEmployees, 5)
  assert.equal(summary.totalAssignedTasks, 23)
  assert.equal(summary.totalPendingTasks, 3)
  assert.equal(summary.overloadedOfficers, 1)
  assert.equal(summary.underutilizedOfficers, 1)
})

test('validateAllocationForm enforces role fit, route requirements, leave checks, and duplicate routes', () => {
  const rows = buildEmployeeWorkloadRows({
    employees: SAMPLE_EMPLOYEES,
    allLogs: SAMPLE_LOGS,
    selectedDate: '2025-01-31',
    leaves: [{ employee_id: 'EMP1150', status: 'Approved', from_date: '2025-01-31', to_date: '2025-01-31' }],
  })

  // Role mismatch: Postman assigned Customer Service Counter
  const badRole = validateAllocationForm(
    {
      date: '2025-01-31',
      employee_id: 'EMP1138',
      designation: 'Postman',
      task_type: 'Customer Service Counter',
      assigned_tasks: 4,
    },
    rows,
  )
  assert.equal(badRole.valid, false)
  assert.ok(badRole.errors.task_type.includes('Postman cannot be assigned'))

  // Duplicate route ID owned by EMP1137
  const dupRoute = validateAllocationForm(
    {
      date: '2025-01-31',
      employee_id: 'EMP1138',
      designation: 'Postman',
      task_type: 'Mail & Parcel Delivery',
      route_id: 'R61-NEG',
      route_length_km: 12,
      delivery_points: 120,
      assigned_tasks: 4,
    },
    rows,
  )
  assert.equal(dupRoute.valid, false)
  assert.ok(dupRoute.errors.route_id.includes('already assigned'))

  // Employee on approved leave
  const onLeaveCheck = validateAllocationForm(
    {
      date: '2025-01-31',
      employee_id: 'EMP1150',
      designation: 'Postal Assistant',
      task_type: 'Workflow Coordination',
      assigned_tasks: 3,
    },
    rows,
  )
  assert.equal(onLeaveCheck.valid, false)
  assert.ok(onLeaveCheck.errors.employee_id.includes('approved leave'))
})

test('computeAutoBalancePreview and generateWorkloadRecommendations propose safe reassignments', () => {
  const rows = buildEmployeeWorkloadRows({
    employees: SAMPLE_EMPLOYEES,
    allLogs: SAMPLE_LOGS,
    selectedDate: '2025-01-31',
    leaves: [],
  })
  const recs = generateWorkloadRecommendations(rows)
  assert.ok(recs.length >= 3)
  assert.ok(recs.some((r) => r.id === 'REC-REDISTRIBUTE'))

  const preview = computeAutoBalancePreview(rows)
  assert.ok(preview.transfers.length >= 1)
  assert.equal(preview.transfers[0].from_employee_id, 'EMP1137')
  assert.equal(preview.transfers[0].to_employee_id, 'EMP1145')
  assert.ok(preview.afterSummary.overloadedOfficers <= preview.beforeSummary.overloadedOfficers)
})
