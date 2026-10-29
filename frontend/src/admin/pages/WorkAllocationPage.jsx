import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Info,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ListChecks,
  ListTodo,
  Square,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useAuth } from '../data/auth'
import {
  approveAllocation,
  authorizeAttendance,
  autoBalanceWorkload,
  create,
  getAllocation,
  list,
  listEntitlements,
  update,
} from '../data/repository'
import {
  DEFAULT_DAILY_TARGET_TASKS,
  TASK_ROLE_FIT,
  buildEmployeeWorkloadRows,
  calculateWorkloadSummaryCards,
  computeAutoBalancePreview,
  generateWorkloadRecommendations,
  validateAllocationForm,
  resolveEmployeeTaskItems,
} from '../data/workAllocationHelpers'
import ChartCard from '../ui/ChartCard'
import { Donut } from '../ui/charts'
import LoadingState from '../ui/LoadingState'

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const TASK_OPTIONS = Object.keys(TASK_ROLE_FIT)
const PRIORITY_OPTIONS = ['Normal', 'High', 'Urgent', 'Low']

export const DEFAULT_DAILY_OPERATIONAL_CHECKLIST = [
  'Parcel Delivery by Route',
  'Ordinary Letter Delivery',
  'Registered Mail Delivery',
  'Pending Mail and Parcel Clearance',
  'Undelivered Article Processing',
  'Proof of Delivery Verification',
  'Incoming Mail Registration',
  'Parcel Registration and Sorting',
  'Article Scanning and Tracking Updates',
  'Counter Customer Service',
  'Postal Financial Transactions',
  'Postage and Fee Verification',
  'Money Order Processing',
  'Incorrect Record and Address Verification',
  'Postal Clerk Duties',
]

export default function WorkAllocationPage() {
  const { user } = useAuth()
  const isPostmaster = user?.role === 'postmaster'

  // ── Core State ──────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [employees, setEmployees] = useState([])
  const [allLogs, setAllLogs] = useState([])
  const [attendanceLogs, setAttendanceLogs] = useState([])
  const [leaves, setLeaves] = useState([])
  const [backendPlan, setBackendPlan] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // ── Table Filter & Pagination State ─────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [postOfficeFilter, setPostOfficeFilter] = useState('All')
  const [designationFilter, setDesignationFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // ── Modals / Drawers State ──────────────────────────────────────────────
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [allocationForm, setAllocationForm] = useState({
    date: todayIso(),
    employee_id: '',
    designation: '',
    task_type: 'Mail & Parcel Delivery',
    route_id: '',
    route_length_km: '15',
    delivery_points: '180',
    assigned_tasks: '5',
    priority: 'Normal',
    start_time: '08:00',
    expected_completion_time: '16:30',
    notes: '',
    checkDuplicateTask: true,
  })

  const [expandedRowId, setExpandedRowId] = useState(null)
  const [togglingTaskId, setTogglingTaskId] = useState(null)
  const [detailEmployee, setDetailEmployee] = useState(null)
  const [reassignModal, setReassignModal] = useState(null)
  const [autoBalanceOpen, setAutoBalanceOpen] = useState(false)
  const [autoBalanceResult, setAutoBalanceResult] = useState(null)
  const [autoBalancing, setAutoBalancing] = useState(false)
  const [reviewRecModal, setReviewRecModal] = useState(null)

  // Attendance authorization state
  const [authAttendanceModalOpen, setAuthAttendanceModalOpen] = useState(false)
  const [selectedOfficersToAuth, setSelectedOfficersToAuth] = useState([])
  const [authStatusChoice, setAuthStatusChoice] = useState('Present')
  const [authNotes, setAuthNotes] = useState('Authorized by Postmaster for work allocation')
  const [authorizingAttendance, setAuthorizingAttendance] = useState(false)

  // ── Load Real Application Data ──────────────────────────────────────────
  const loadData = useCallback(async (targetDate = selectedDate) => {
    setLoading(true)
    setError('')
    try {
      const [empList, logList, attList, leaveList, planData] = await Promise.all([
        list('employee'),
        list('daily_kpi_log'),
        list('attendance_log', { filters: { date: targetDate } }).catch(() => []),
        listEntitlements('leave').catch(() => []),
        getAllocation(targetDate, []).catch(() => null),
      ])
      setEmployees(Array.isArray(empList) ? empList : [])
      setAllLogs(Array.isArray(logList) ? logList : [])
      setAttendanceLogs(Array.isArray(attList) ? attList : [])
      setLeaves(Array.isArray(leaveList) ? leaveList : [])
      setBackendPlan(planData)
    } catch (err) {
      setError(err.message || 'Unable to load work allocation records.')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData(selectedDate)
  }, [selectedDate, loadData])

  // ── Available Recorded Dates for Quick Switching ────────────────────────
  const recordedLogDates = useMemo(() => {
    const set = new Set()
    for (const log of allLogs) {
      if (log.date) set.add(log.date)
    }
    return Array.from(set).sort().reverse()
  }, [allLogs])

  // ── Compute Employee Workload Rows & KPI Summary Cards ──────────────────
  const workloadRows = useMemo(
    () =>
      buildEmployeeWorkloadRows({
        employees,
        allLogs,
        attendanceForDate: attendanceLogs,
        leaves,
        selectedDate,
        targetTasks: DEFAULT_DAILY_TARGET_TASKS,
      }),
    [employees, allLogs, attendanceLogs, leaves, selectedDate],
  )

  const summary = useMemo(
    () => calculateWorkloadSummaryCards(workloadRows, backendPlan),
    [workloadRows, backendPlan],
  )

  const recommendations = useMemo(
    () => generateWorkloadRecommendations(workloadRows),
    [workloadRows],
  )

  const autoBalancePreview = useMemo(
    () => computeAutoBalancePreview(workloadRows, DEFAULT_DAILY_TARGET_TASKS),
    [workloadRows],
  )

  const unrecordedOfficers = useMemo(
    () => workloadRows.filter((r) => !r.is_eligible && !r.on_leave && r.availability === 'Attendance Not Recorded'),
    [workloadRows],
  )

  // ── Filter Options & Filtered Table Rows ────────────────────────────────
  const postOfficeOptions = useMemo(() => {
    const s = new Set(workloadRows.map((r) => r.post_office).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [workloadRows])

  const designationOptions = useMemo(() => {
    const s = new Set(workloadRows.map((r) => r.designation).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [workloadRows])

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return workloadRows.filter((row) => {
      if (postOfficeFilter !== 'All' && row.post_office !== postOfficeFilter) return false
      if (designationFilter !== 'All' && row.designation !== designationFilter) return false
      if (statusFilter !== 'All' && row.workload_status !== statusFilter) return false
      if (q) {
        const hay = `${row.employee_id} ${row.employee_name} ${row.designation} ${row.primary_task_type} ${row.route_id}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [workloadRows, postOfficeFilter, designationFilter, statusFilter, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages)
    const start = (safePage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage, totalPages])

  // Reset pagination when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1)
  }, [searchQuery, postOfficeFilter, designationFilter, statusFilter, selectedDate])

  // ── Upsert Helper for Daily KPI Log Allocation ──────────────────────────
  async function saveEmployeeDailyAllocation({
    dateStr,
    employeeRow,
    assignedTasks,
    completedTasks,
    taskType,
    routeId,
    routeLengthKm,
    deliveryPoints,
    priority,
    startTime,
    expectedCompletionTime,
    taskItems,
    notes,
  }) {
    const docId = `${employeeRow.employee_id}-${dateStr}`
    const assigned = Math.max(0, Math.round(Number(assignedTasks) || 0))
    const completed = Math.min(assigned, Math.max(0, Math.round(Number(completedTasks ?? employeeRow.completed_tasks) || 0)))
    const uncompleted = Math.max(0, assigned - completed)
    const dayName = new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' })

    const existingOnDate = allLogs.find((l) => (l.name || l._id) === docId || (l.employee_id === employeeRow.employee_id && l.date === dateStr))

    const payload = {
      ...(existingOnDate || {}),
      name: docId,
      employee_id: employeeRow.employee_id,
      employee_name: employeeRow.employee_name,
      post_office: employeeRow.post_office,
      designation: employeeRow.designation,
      work_category: employeeRow.work_category,
      date: dateStr,
      day_of_week: dayName,
      primary_task_type: taskType || employeeRow.primary_task_type,
      route_id: routeId !== undefined ? routeId : employeeRow.route_id,
      route_length_km: routeLengthKm !== undefined ? Number(routeLengthKm) || 0 : employeeRow.route_length_km,
      delivery_points: deliveryPoints !== undefined ? Number(deliveryPoints) || 0 : employeeRow.delivery_points,
      assigned_work_count: assigned,
      completed_work_count: completed,
      uncompleted_work_count: uncompleted,
      priority: priority || employeeRow.priority || 'Normal',
      start_time: startTime || employeeRow.start_time || '08:00',
      expected_completion_time: expectedCompletionTime || employeeRow.expected_completion_time || '16:30',
      notes: notes !== undefined ? notes : employeeRow.notes || '',
      task_items: taskItems !== undefined ? taskItems : (existingOnDate?.task_items || employeeRow.task_items || []),
    }

    if (existingOnDate) {
      await update('daily_kpi_log', docId, payload)
    } else {
      await create('daily_kpi_log', payload)
    }
  }

  // ── Handler: Toggle Task Completion (Checkbox) ───────────────────────────
  async function handleToggleTaskComplete(employeeRow, taskId) {
    if (!employeeRow || togglingTaskId) return
    setTogglingTaskId(taskId)
    try {
      const currentTasks = resolveEmployeeTaskItems(employeeRow)
      const updatedTasks = currentTasks.map((t) => {
        if (t.id === taskId) {
          const nextCompleted = !t.completed
          return {
            ...t,
            completed: nextCompleted,
            completed_at: nextCompleted
              ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : null,
          }
        }
        return t
      })

      const newCompleted = updatedTasks.filter((t) => t.completed).length
      const newPending = Math.max(0, employeeRow.assigned_tasks - newCompleted)

      await saveEmployeeDailyAllocation({
        dateStr: selectedDate,
        employeeRow,
        assignedTasks: employeeRow.assigned_tasks,
        completedTasks: newCompleted,
        taskItems: updatedTasks,
        taskType: employeeRow.primary_task_type,
        routeId: employeeRow.route_id,
        routeLengthKm: employeeRow.route_length_km,
        deliveryPoints: employeeRow.delivery_points,
        priority: employeeRow.priority,
        startTime: employeeRow.start_time,
        expectedCompletionTime: employeeRow.expected_completion_time,
        notes: employeeRow.notes,
      })

      if (detailEmployee && detailEmployee.employee_id === employeeRow.employee_id) {
        setDetailEmployee((prev) => ({
          ...prev,
          completed_tasks: newCompleted,
          pending_tasks: newPending,
          task_items: updatedTasks,
        }))
      }

      await loadData(selectedDate)
    } catch (err) {
      setError(err.message || 'Failed to update task completion status.')
    } finally {
      setTogglingTaskId(null)
    }
  }

  // ── Render: Employee Assigned Tasks Clearance Checklist ──────────────────
  function renderEmployeeTasksChecklist(empRow, isModal = false) {
    if (!empRow) return null
    const tasks = resolveEmployeeTaskItems(empRow)
    const pendingTasks = tasks.filter((t) => !t.completed)
    const completedTasks = tasks.filter((t) => t.completed)
    const pctCompleted = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0

    if (tasks.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-[#DFE8F2] bg-slate-50/70 p-5 text-center">
          <Briefcase className="mx-auto size-6 text-[#94A3B8]" />
          <p className="mt-1.5 text-xs font-semibold text-[#172B4D]">No Assigned Tasks on Record</p>
          <p className="mt-0.5 text-[11px] text-[#64748B]">
            No workload batches are currently assigned to {empRow.employee_name} for {selectedDate}.
          </p>
          {isPostmaster && (
            <button
              type="button"
              onClick={() => openCreateDrawerFor(empRow)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1677D2] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#125ea7]"
            >
              <Plus className="size-3.5" />
              Assign Work to {empRow.employee_name}
            </button>
          )}
        </div>
      )
    }

    return (
      <div className={`space-y-4 rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs ${isModal ? 'mt-4' : ''}`}>
        {/* Header & Progress Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFE8F2] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <ListTodo className="size-4 text-[#1677D2]" />
              <h4 className="text-xs font-bold text-[#0B1F3A]">
                Assigned Tasks &amp; Clearance Checklist — {empRow.employee_name}
              </h4>
              <span className="font-mono text-[10px] text-[#64748B]">({empRow.employee_id})</span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#64748B]">
              Check the box when an assigned task is finished. Pending task counts update automatically in real-time.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[#1677D2]">
              {tasks.length} Assigned
            </span>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-emerald-700">
              {completedTasks.length} Completed
            </span>
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-amber-800">
              {pendingTasks.length} Pending
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-[#0B1F3A]">
              Task Clearance Progress: <strong className="text-[#1677D2]">{completedTasks.length} of {tasks.length} Cleared</strong>
            </span>
            <span className="font-bold text-[#1677D2]">{pctCompleted}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-300 ${
                pctCompleted === 100 ? 'bg-emerald-600' : 'bg-[#1677D2]'
              }`}
              style={{ width: `${pctCompleted}%` }}
            />
          </div>
        </div>

        {/* SECTION 1: PENDING TASKS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-amber-600" />
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Pending Tasks ({pendingTasks.length})
              </h5>
            </div>
            <span className="text-[10px] text-[#64748B]">Click checkbox to mark completed</span>
          </div>

          {pendingTasks.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <div>
                <span className="font-bold">All assigned tasks completed!</span>
                <p className="text-[11px] text-emerald-700">
                  {empRow.employee_name} has successfully cleared all {tasks.length} allocated batches for {selectedDate}.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task) => {
                const isToggling = togglingTaskId === task.id
                return (
                  <div
                    key={task.id}
                    className="group flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/30 p-3 transition-colors hover:border-[#1677D2] hover:bg-blue-50/30"
                  >
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleTaskComplete(empRow, task.id)}
                      className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded border-2 border-slate-300 bg-white transition-all hover:border-[#1677D2] hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#1677D2] disabled:opacity-50"
                      title="Click to check off and mark task as completed"
                      aria-label={`Mark task ${task.title} as completed`}
                    >
                      {isToggling ? (
                        <RefreshCw className="size-3 animate-spin text-[#1677D2]" />
                      ) : (
                        <Square className="size-3 text-transparent group-hover:text-slate-300" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-[#0B1F3A]">{task.title}</span>
                        <span className="inline-flex items-center rounded border border-amber-200 bg-amber-100/70 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                          Pending
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#64748B]">
                        <span className="font-medium text-[#172B4D]">{task.task_type}</span>
                        {task.route_id && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-[#0B1F3A]">
                            Route: {task.route_id}
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 font-semibold ${
                            task.priority === 'High'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-[#475569]'
                          }`}
                        >
                          Priority: {task.priority}
                        </span>
                        <span>⏱ Est: {task.estimated_duration}</span>
                        <span>Due: {task.due_time}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleTaskComplete(empRow, task.id)}
                      className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[#DFE8F2] bg-white px-2 py-1 text-[11px] font-semibold text-[#172B4D] shadow-2xs hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                      title="Mark this task as completed"
                    >
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      Mark Done
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: COMPLETED TASKS */}
        {completedTasks.length > 0 && (
          <div className="space-y-2 border-t border-[#DFE8F2] pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                  Completed Tasks ({completedTasks.length})
                </h5>
              </div>
              <span className="text-[10px] text-[#64748B]">Click checkbox to uncheck if marked by mistake</span>
            </div>

            <div className="space-y-2">
              {completedTasks.map((task) => {
                const isToggling = togglingTaskId === task.id
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/20 p-2.5 transition-colors"
                  >
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleTaskComplete(empRow, task.id)}
                      className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded border-2 border-emerald-600 bg-emerald-600 text-white transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                      title="Click to uncheck (move back to pending)"
                      aria-label={`Unmark completed task ${task.title}`}
                    >
                      {isToggling ? (
                        <RefreshCw className="size-3 animate-spin text-white" />
                      ) : (
                        <CheckSquare className="size-3 text-white" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-xs font-medium text-slate-500 line-through">
                          {task.title}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-100/70 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 className="size-2.5" />
                          Done {task.completed_at ? `(${task.completed_at})` : ''}
                        </span>
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[#94A3B8]">
                        <span>{task.task_type}</span>
                        {task.route_id && <span>Route: {task.route_id}</span>}
                        <span>Est: {task.estimated_duration}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Handlers: Open Create Allocation Drawer ─────────────────────────────
  function openCreateDrawerFor(empRow = null) {
    const targetEmp = empRow || workloadRows[0]
    const defaultTask =
      targetEmp?.primary_task_type ||
      (targetEmp?.work_category === 'Delivery (Field)' ? 'Mail & Parcel Delivery' : 'Customer Service Counter')
    setAllocationForm({
      date: selectedDate,
      employee_id: targetEmp?.employee_id || '',
      designation: targetEmp?.designation || '',
      task_type: defaultTask,
      route_id: targetEmp?.route_id || (targetEmp?.work_category === 'Delivery (Field)' ? 'R61-NEG' : ''),
      route_length_km: String(targetEmp?.route_length_km || 15),
      delivery_points: String(targetEmp?.delivery_points || 180),
      assigned_tasks: String(targetEmp?.assigned_tasks || DEFAULT_DAILY_TARGET_TASKS),
      priority: targetEmp?.priority || 'Normal',
      start_time: targetEmp?.start_time || '08:00',
      expected_completion_time: targetEmp?.expected_completion_time || '16:30',
      notes: targetEmp?.notes || '',
      checkDuplicateTask: true,
    })
    setFormErrors({})
    setCreateDrawerOpen(true)
  }

  function handleEmployeeSelectInForm(empId) {
    const found = workloadRows.find((r) => r.employee_id === empId)
    if (!found) {
      setAllocationForm((prev) => ({ ...prev, employee_id: empId, designation: '' }))
      return
    }
    const defaultTask =
      found.primary_task_type ||
      (found.work_category === 'Delivery (Field)' ? 'Mail & Parcel Delivery' : 'Customer Service Counter')
    setAllocationForm((prev) => ({
      ...prev,
      employee_id: found.employee_id,
      designation: found.designation,
      task_type: defaultTask,
      route_id: found.route_id || (found.work_category === 'Delivery (Field)' ? 'R61-NEG' : ''),
      route_length_km: String(found.route_length_km || 15),
      delivery_points: String(found.delivery_points || 180),
      assigned_tasks: String(found.assigned_tasks || DEFAULT_DAILY_TARGET_TASKS),
    }))
  }

  async function handleCreateAllocationSubmit(event) {
    event.preventDefault()
    if (!isPostmaster) {
      setError('Only an authenticated Postmaster may create or modify work allocations.')
      return
    }
    const validation = validateAllocationForm(allocationForm, workloadRows)
    setFormErrors(validation.errors)
    if (!validation.valid) return

    const empRow = workloadRows.find((r) => r.employee_id === allocationForm.employee_id)
    if (!empRow) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      await saveEmployeeDailyAllocation({
        dateStr: allocationForm.date,
        employeeRow: empRow,
        assignedTasks: Number(allocationForm.assigned_tasks),
        completedTasks: empRow.is_live_date_log ? empRow.completed_tasks : 0,
        taskType: allocationForm.task_type,
        routeId: TASK_ROLE_FIT[allocationForm.task_type]?.isDelivery ? allocationForm.route_id.trim() : '',
        routeLengthKm: TASK_ROLE_FIT[allocationForm.task_type]?.isDelivery ? Number(allocationForm.route_length_km) : 0,
        deliveryPoints: TASK_ROLE_FIT[allocationForm.task_type]?.isDelivery ? Number(allocationForm.delivery_points) : 0,
        priority: allocationForm.priority,
        startTime: allocationForm.start_time,
        expectedCompletionTime: allocationForm.expected_completion_time,
        notes: allocationForm.notes.trim(),
      })
      setCreateDrawerOpen(false)
      if (allocationForm.date !== selectedDate) {
        setSelectedDate(allocationForm.date)
      } else {
        await loadData(selectedDate)
      }
      setNotice(
        `Saved work allocation for ${empRow.employee_name} (${empRow.employee_id}) on ${allocationForm.date}: ${allocationForm.assigned_tasks} tasks (${allocationForm.task_type}).`,
      )
    } catch (err) {
      setError(err.message || 'Could not save the work allocation.')
    } finally {
      setSaving(false)
    }
  }

  // ── Handler: Confirm Reassign Work Modal ────────────────────────────────
  async function handleConfirmReassign(event) {
    event.preventDefault()
    if (!reassignModal || !isPostmaster) return
    const { fromRow, toEmployeeId, transferCount, reason } = reassignModal
    const toRow = workloadRows.find((r) => r.employee_id === toEmployeeId)
    if (!fromRow || !toRow) {
      setError('Please select a valid receiving colleague.')
      return
    }
    const count = Math.max(1, Math.min(fromRow.assigned_tasks, Number(transferCount) || 1))

    setSaving(true)
    setError('')
    setNotice('')
    try {
      await saveEmployeeDailyAllocation({
        dateStr: selectedDate,
        employeeRow: fromRow,
        assignedTasks: Math.max(0, fromRow.assigned_tasks - count),
        completedTasks: Math.min(fromRow.completed_tasks, Math.max(0, fromRow.assigned_tasks - count)),
        notes: `Reassigned ${count} task(s) to ${toRow.employee_id}. ${reason || ''}`.trim(),
      })
      await saveEmployeeDailyAllocation({
        dateStr: selectedDate,
        employeeRow: toRow,
        assignedTasks: toRow.assigned_tasks + count,
        completedTasks: toRow.completed_tasks,
        notes: `Received ${count} reassigned task(s) from ${fromRow.employee_id}. ${reason || ''}`.trim(),
      })
      setReassignModal(null)
      setReviewRecModal(null)
      await loadData(selectedDate)
      setNotice(
        `Reassigned ${count} task(s) from ${fromRow.employee_name} (${fromRow.employee_id}) to ${toRow.employee_name} (${toRow.employee_id}) for ${selectedDate}.`,
      )
    } catch (err) {
      setError(err.message || 'Could not complete work reassignment.')
    } finally {
      setSaving(false)
    }
  }

  // ── Handler: Auto-Balance Workload Using Employee Attendance ───────────
  async function handleRunAutoBalance() {
    if (!isPostmaster) {
      setError('Only an authenticated Postmaster may execute auto-balance workload.')
      return
    }
    setAutoBalancing(true)
    setError('')
    setNotice('')
    try {
      const res = await autoBalanceWorkload(selectedDate, {
        post_office: postOfficeFilter !== 'All' ? postOfficeFilter : '',
        checklist: DEFAULT_DAILY_OPERATIONAL_CHECKLIST,
        confirm: false,
      })
      setAutoBalanceResult(res)
      setAutoBalanceOpen(true)
      if (res && res.ok) {
        setNotice(
          res.message ||
            `Auto-Balance proposal calculated: ${res.tasks_assigned || 0} task(s) across ${res.eligible_count || 0} attending officer(s). Review and confirm below.`,
        )
      } else if (res && res.attendance_missing) {
        setNotice(res.message || 'Attendance verification required for this date.')
      } else if (res && !res.ok) {
        setNotice(res.message || 'Auto-Balance evaluated: review details below.')
      }
    } catch (err) {
      setError(err.message || 'Could not execute auto-balance workload operation.')
    } finally {
      setAutoBalancing(false)
    }
  }

  // ── Handler: Confirm Auto-Balance Workload Plan (Persists to MongoDB) ──
  async function handleConfirmAutoBalance() {
    if (!isPostmaster) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await autoBalanceWorkload(selectedDate, {
        post_office: postOfficeFilter !== 'All' ? postOfficeFilter : '',
        checklist: DEFAULT_DAILY_OPERATIONAL_CHECKLIST,
        confirm: true,
      })
      setAutoBalanceOpen(false)
      await loadData(selectedDate)
      setNotice(
        res?.message || `Auto-Balance successfully persisted to MongoDB for ${selectedDate}.`,
      )
    } catch (err) {
      setError(err.message || 'Could not apply and persist auto-balance plan.')
    } finally {
      setSaving(false)
    }
  }

  // ── Handler: Authorize All Staff and Immediately Auto-Balance ───────────
  async function handleAuthorizeAndAutoBalance() {
    if (!isPostmaster) return
    setAutoBalancing(true)
    setError('')
    try {
      const res = await autoBalanceWorkload(selectedDate, {
        post_office: postOfficeFilter !== 'All' ? postOfficeFilter : '',
        checklist: DEFAULT_DAILY_OPERATIONAL_CHECKLIST,
        authorize_all_active: true,
        confirm: false,
      })
      await loadData(selectedDate)
      setAutoBalanceResult(res)
      setNotice(res?.message || 'Attendance authorized and workload balance preview generated.')
    } catch (err) {
      setError(err.message || 'Could not authorize attendance and run auto-balance.')
    } finally {
      setAutoBalancing(false)
    }
  }

  // ── Handler: Quick Authorize All Active Staff on Selected Date ─────────
  async function handleQuickAuthorizeAll() {
    if (!isPostmaster) return
    setAuthorizingAttendance(true)
    setError('')
    try {
      const res = await authorizeAttendance({
        date: selectedDate,
        postOffice: postOfficeFilter !== 'All' ? postOfficeFilter : '',
        status: 'Present',
        notes: `Authorized by Postmaster for ${selectedDate}`,
      })
      await loadData(selectedDate)
      setNotice(res?.message || `Successfully authorized attendance for active officers on ${selectedDate}.`)
    } catch (err) {
      setError(err.message || 'Could not authorize attendance records.')
    } finally {
      setAuthorizingAttendance(false)
    }
  }

  // ── Handler: Open Modal with Checkboxes for Individual Staff ──────────
  function handleOpenAuthModal() {
    const unrecIds = unrecordedOfficers.map((o) => o.employee_id)
    setSelectedOfficersToAuth(unrecIds.length > 0 ? unrecIds : workloadRows.filter((r) => !r.on_leave).map((r) => r.employee_id))
    setAuthAttendanceModalOpen(true)
  }

  // ── Handler: Submit Selected Officers Attendance Authorization ─────────
  async function handleSubmitAttendanceAuth() {
    if (!isPostmaster) return
    if (!selectedOfficersToAuth.length) {
      setError('Please select at least one officer to authorize.')
      return
    }
    setAuthorizingAttendance(true)
    setError('')
    try {
      const res = await authorizeAttendance({
        date: selectedDate,
        employeeIds: selectedOfficersToAuth,
        status: authStatusChoice,
        notes: authNotes,
        postOffice: postOfficeFilter !== 'All' ? postOfficeFilter : '',
      })
      setAuthAttendanceModalOpen(false)
      await loadData(selectedDate)
      setNotice(res?.message || `Attendance authorized for ${selectedOfficersToAuth.length} officer(s) on ${selectedDate}.`)
    } catch (err) {
      setError(err.message || 'Failed to submit attendance authorization.')
    } finally {
      setAuthorizingAttendance(false)
    }
  }

  const isSelectedDateUsingBaseline = useMemo(
    () => workloadRows.length > 0 && workloadRows.every((r) => !r.is_live_date_log),
    [workloadRows],
  )

  const selectedFormIsDelivery = Boolean(TASK_ROLE_FIT[allocationForm.task_type]?.isDelivery)

  return (
    <div className="space-y-5">
      {/* ── 1. Page Header & Breadcrumb ────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
            <span>Dashboard</span>
            <span>/</span>
            <span>Operations</span>
            <span>/</span>
            <span className="font-semibold text-[#1677D2]">Work Allocation</span>
          </nav>
          <h1 className="text-xl font-bold tracking-tight text-[#0B1F3A] sm:text-2xl">
            Work Allocation
          </h1>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Plan daily assignments and balance employee workloads fairly.
          </p>
        </div>

        {/* Date Selector + Primary & Secondary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] px-3 py-1.5">
            <Calendar className="size-4 text-[#1677D2]" />
            <label htmlFor="alloc-date-picker" className="text-[11px] font-semibold text-[#64748B]">
              Allocation Date:
            </label>
            <input
              id="alloc-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#0B1F3A] focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={!isPostmaster || loading || autoBalancing}
            onClick={handleRunAutoBalance}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#1677D2] bg-blue-50/70 px-4 text-xs font-bold text-[#1677D2] shadow-2xs transition-colors hover:bg-blue-100 disabled:opacity-50"
          >
            <Scale className="size-4" />
            {autoBalancing ? 'Balancing Workload...' : 'Auto-Balance Workload'}
          </button>

          <button
            type="button"
            disabled={!isPostmaster || loading || autoBalancing}
            onClick={() => openCreateDrawerFor(null)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#125ea7] disabled:opacity-50"
          >
            <Plus className="size-4" />
            + Create Allocation
          </button>
        </div>
      </div>

      {/* Quick Recorded Dates Bar + Baseline Info Notice */}
      {recordedLogDates.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DFE8F2] bg-white px-4 py-2.5 text-xs shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-[#64748B]">Recent Logged Dates:</span>
            <button
              type="button"
              onClick={() => setSelectedDate(todayIso())}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                selectedDate === todayIso()
                  ? 'bg-[#0B1F3A] text-white'
                  : 'bg-slate-100 text-[#172B4D] hover:bg-blue-50 hover:text-[#1677D2]'
              }`}
            >
              Today ({todayIso()})
            </button>
            {recordedLogDates.slice(0, 6).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDate(d)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  selectedDate === d
                    ? 'bg-[#1677D2] text-white'
                    : 'bg-slate-100 text-[#172B4D] hover:bg-blue-50 hover:text-[#1677D2]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {isSelectedDateUsingBaseline && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
              <Info className="size-3.5 text-amber-600" />
              Showing baseline workload from latest recorded logs ({workloadRows[0]?.source_date}). Click &ldquo;+ Create Allocation&rdquo; or &ldquo;Auto-Balance&rdquo; to save {selectedDate} records.
            </span>
          )}
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="ml-3 font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="ml-3 font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading employee workload distribution and route allocations..." />
      ) : (
        <>
          {/* ── 2. Five KPI Summary Cards ──────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {/* Card 1: Total Employees */}
            <div className="rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B]">Total Employees</span>
                <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#1677D2]">
                  <Users className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-[#0B1F3A]">{summary.totalEmployees}</p>
              <p className="mt-1 text-[11px] font-medium text-emerald-700">
                ● Active roster ({workloadRows.filter((r) => !r.on_leave).length} available)
              </p>
            </div>

            {/* Card 2: Assigned Tasks */}
            <div className="rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B]">Assigned Tasks</span>
                <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Briefcase className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-[#0B1F3A]">{summary.totalAssignedTasks}</p>
              <p className="mt-1 text-[11px] text-[#64748B]">
                {summary.totalCompletedTasks} completed across {summary.employeesWithAssignedTasks} staff
              </p>
            </div>

            {/* Card 3: Unassigned / Pending Tasks */}
            <div className="rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B]">Unassigned Tasks</span>
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-[#0B1F3A]">{summary.unassignedTasks}</p>
              <p className="mt-1 text-[11px] font-medium text-amber-700">
                Pending clearance / reallocation
              </p>
            </div>

            {/* Card 4: Balanced Workloads */}
            <div className="rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B]">Balanced Workloads</span>
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-emerald-700">{summary.balancedWorkloads}</p>
              <p className="mt-1 text-[11px] text-[#64748B]">
                Optimal capacity (70%–95%) · {summary.nearCapacityCount} near cap
              </p>
            </div>

            {/* Card 5: Overloaded Officers */}
            <div className="rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B]">Overloaded Officers</span>
                <span className="flex size-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <AlertTriangle className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-rose-600">{summary.overloadedOfficers}</p>
              <p className="mt-1 text-[11px] font-medium text-rose-700">
                {summary.overloadedOfficers > 0
                  ? `Exceeding 110% threshold · ${summary.underutilizedOfficers} underutilized`
                  : `0 overloaded · ${summary.underutilizedOfficers} underutilized`}
              </p>
            </div>
          </div>

          {/* ── Interactive Attendance Verification Required Banner ────────── */}
          {unrecordedOfficers.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 p-4 shadow-xs">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <AlertTriangle className="size-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-amber-950">
                        Staff Attendance Verification Required
                      </h3>
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
                        {unrecordedOfficers.length} Officer{unrecordedOfficers.length === 1 ? '' : 's'} Unrecorded
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-amber-800">
                      Attendance records have not been recorded for officers on <strong>{selectedDate}</strong>. Under Sri Lanka Postal Department Policy, officers are excluded from daily task allocations until attendance is confirmed or authorized by the Postmaster.
                    </p>
                  </div>
                </div>

                {isPostmaster && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={authorizingAttendance}
                      onClick={handleQuickAuthorizeAll}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1677D2] px-3.5 text-xs font-bold text-white shadow-xs hover:bg-[#125ea7] disabled:opacity-50"
                    >
                      <Zap className="size-3.5" />
                      {authorizingAttendance ? 'Authorizing...' : 'Authorize All Active (1-Click)'}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenAuthModal}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      <CheckSquare className="size-3.5" />
                      Verify & Authorize Staff...
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 3. Employee Workload Distribution Table ────────────────────── */}
          <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-3 border-b border-[#DFE8F2] pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A]">
                  Employee Workload Distribution
                </h2>
                <p className="text-xs text-[#64748B]">
                  Showing {filteredRows.length} of {workloadRows.length} postal officers · Daily benchmark: {DEFAULT_DAILY_TARGET_TASKS} task batches (100%)
                </p>
              </div>

              {/* Search, Post Office, Designation & Status Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-[#64748B]" />
                  <input
                    type="text"
                    placeholder="Search ID, name, route..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search employees"
                    className="h-8 w-44 rounded-lg border border-[#DFE8F2] bg-[#F8FAFC] pr-2.5 pl-8 text-xs text-[#172B4D] placeholder:text-[#94A3B8] focus:border-[#1677D2] focus:bg-white focus:outline-none sm:w-52"
                  />
                </div>

                <select
                  aria-label="Filter by Post Office"
                  value={postOfficeFilter}
                  onChange={(e) => setPostOfficeFilter(e.target.value)}
                  className="h-8 rounded-lg border border-[#DFE8F2] bg-[#F8FAFC] px-2.5 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                >
                  {postOfficeOptions.map((po) => (
                    <option key={po} value={po}>
                      {po === 'All' ? 'All Post Offices' : po}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by Designation"
                  value={designationFilter}
                  onChange={(e) => setDesignationFilter(e.target.value)}
                  className="h-8 rounded-lg border border-[#DFE8F2] bg-[#F8FAFC] px-2.5 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                >
                  {designationOptions.map((des) => (
                    <option key={des} value={des}>
                      {des === 'All' ? 'All Designations' : des}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by Workload Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 rounded-lg border border-[#DFE8F2] bg-[#F8FAFC] px-2.5 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Balanced">Balanced</option>
                  <option value="Underutilized">Underutilized</option>
                  <option value="Near Capacity">Near Capacity</option>
                  <option value="Overloaded">Overloaded</option>
                </select>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-[#172B4D]">No employees match the selected filters</p>
                <p className="mt-1 text-xs text-[#64748B]">Try clearing the search query or selecting &ldquo;All Statuses&rdquo;.</p>
              </div>
            ) : (
              <>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#DFE8F2] bg-[#F8FAFC] text-[10px] font-bold tracking-wider text-[#64748B] uppercase">
                      <tr>
                        <th className="py-3 px-3">Employee ID</th>
                        <th className="py-3 px-3">Employee Name</th>
                        <th className="py-3 px-3">Designation</th>
                        <th className="py-3 px-3 text-center">Assigned Tasks</th>
                        <th className="py-3 px-3 text-center">Completed Tasks</th>
                        <th className="py-3 px-3 text-center">Pending Tasks</th>
                        <th className="py-3 px-3 min-w-[160px]">Workload Percentage</th>
                        <th className="py-3 px-3">Workload Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE8F2]">
                      {paginatedRows.map((row) => {
                        const progressWidth = Math.min(100, Math.max(6, row.workload_pct))
                        const isExpanded = expandedRowId === row.employee_id
                        return (
                          <Fragment key={row.employee_id}>
                            <tr className={`transition-colors hover:bg-slate-50/80 ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                            <td className="py-3 px-3 font-mono font-bold text-[#0B1F3A]">
                              {row.employee_id}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-[#0B1F3A]">{row.employee_name}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B]">
                                <span>{row.primary_task_type}</span>
                                {row.route_id && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.2 font-medium text-[#172B4D]">
                                    {row.route_id} ({row.route_length_km} km)
                                  </span>
                                )}
                                {(row.eligibility_tag || row.on_leave) && (
                                  <span className={`rounded border px-1.5 py-0.2 font-semibold ${row.eligibility_class || 'bg-rose-100 text-rose-800'}`} title={row.eligibility_reason || 'Employee attendance status'}>
                                    {row.eligibility_tag || 'On Leave'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-[#475569]">{row.designation}</td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-[#0B1F3A]">{row.assigned_tasks}</span>
                                {row.assigned_tasks > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRowId((prev) => (prev === row.employee_id ? null : row.employee_id))}
                                    className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                                      isExpanded
                                        ? 'bg-[#1677D2] text-white shadow-2xs'
                                        : 'bg-blue-50 text-[#1677D2] hover:bg-blue-100'
                                    }`}
                                    title="Click to view assigned tasks and check off completed work"
                                  >
                                    <ListTodo className="size-2.5" />
                                    {isExpanded ? 'Hide' : `Tasks (${row.completed_tasks}/${row.assigned_tasks})`}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                              {row.completed_tasks}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex min-w-[24px] items-center justify-center rounded-md px-1.5 py-0.5 font-bold ${
                                  row.pending_tasks > 0
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-slate-100 text-[#64748B]'
                                }`}
                              >
                                {row.pending_tasks}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-between text-[11px] font-bold text-[#0B1F3A]">
                                <span>{row.workload_pct}%</span>
                                <span className="text-[10px] font-normal text-[#64748B]">
                                  Target: 100%
                                </span>
                              </div>
                              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${progressWidth}%`,
                                    backgroundColor: row.bar_color,
                                  }}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${row.status_badge_class}`}
                              >
                                {row.workload_status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setDetailEmployee(row)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#DFE8F2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#172B4D] hover:border-[#1677D2] hover:text-[#1677D2]"
                                >
                                  <Eye className="size-3" />
                                  View Details
                                </button>
                                <button
                                  type="button"
                                  disabled={!isPostmaster}
                                  onClick={() => {
                                    const candidate =
                                      workloadRows.find(
                                        (r) =>
                                          r.employee_id !== row.employee_id &&
                                          r.work_category === row.work_category &&
                                          !r.on_leave &&
                                          r.workload_pct < 95,
                                      ) ||
                                      workloadRows.find((r) => r.employee_id !== row.employee_id && !r.on_leave)
                                    setReassignModal({
                                      fromRow: row,
                                      toEmployeeId: candidate?.employee_id || '',
                                      transferCount: Math.max(1, row.pending_tasks || 1),
                                      reason: `Balance workload from ${row.workload_pct}%`,
                                    })
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#1677D2] hover:bg-blue-100 disabled:opacity-50"
                                >
                                  <ArrowRightLeft className="size-3" />
                                  Reassign Work
                                </button>
                              </div>
                            </td>
                          </tr>
                            {isExpanded && (
                              <tr className="border-b border-[#DFE8F2] bg-gradient-to-r from-blue-50/20 via-slate-50/60 to-blue-50/20">
                                <td colSpan={9} className="p-3 sm:p-4">
                                  {renderEmployeeTasksChecklist(row)}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#DFE8F2] pt-3 text-xs text-[#64748B]">
                  <span>
                    Page <strong className="text-[#0B1F3A]">{currentPage}</strong> of{' '}
                    <strong className="text-[#0B1F3A]">{totalPages}</strong> ({filteredRows.length} employees)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DFE8F2] bg-white px-2.5 text-xs font-semibold text-[#172B4D] hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="size-3.5" />
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors ${
                          currentPage === pageNum
                            ? 'bg-[#1677D2] text-white'
                            : 'border border-[#DFE8F2] bg-white text-[#172B4D] hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DFE8F2] bg-white px-2.5 text-xs font-semibold text-[#172B4D] hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── 4. Workload Distribution Visualization + 5. Recommended Actions ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left 7 Cols: Assigned vs Completed Bar Chart + Tier Overview */}
            <div className="space-y-5 lg:col-span-7">
              <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFE8F2] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0B1F3A]">
                      Assigned vs Completed Tasks by Employee
                    </h3>
                    <p className="text-[11px] text-[#64748B]">
                      Comparison of assigned task batches and completed work across all 16 officers
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-[#0B1F3A]">
                      <span className="size-2.5 rounded-xs bg-[#1677D2]" />
                      Assigned Tasks
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[#0B1F3A]">
                      <span className="size-2.5 rounded-xs bg-[#16A34A]" />
                      Completed Tasks
                    </span>
                  </div>
                </div>

                {/* Responsive Grouped Bar Chart */}
                <div className="mt-4 overflow-x-auto pb-2">
                  <div className="flex h-52 min-w-[600px] items-end justify-between gap-2 border-b border-[#DFE8F2] px-2 pt-6">
                    {workloadRows.map((row) => {
                      const maxTaskScale = Math.max(8, ...workloadRows.map((r) => r.assigned_tasks))
                      const assignedHeight = Math.round((row.assigned_tasks / maxTaskScale) * 140)
                      const completedHeight = Math.round((row.completed_tasks / maxTaskScale) * 140)
                      const shortName = row.employee_name.split(' ')[0]
                      return (
                        <div
                          key={row.employee_id}
                          className="group flex flex-1 flex-col items-center"
                        >
                          <div className="mb-1 flex items-end justify-center gap-1">
                            {/* Assigned bar */}
                            <div className="flex flex-col items-center">
                              <span className="mb-0.5 text-[9px] font-bold text-[#1677D2]">
  
                              </span>
                              <div
                                className="w-3 rounded-t bg-[#1677D2] transition-all group-hover:bg-[#125ea7]"
                                style={{ height: `${Math.max(4, assignedHeight)}px` }}
                                title={`${row.employee_name} (${row.employee_id}) — Assigned: ${row.assigned_tasks}`}
                              />
                            </div>
                            {/* Completed bar */}
                            <div className="flex flex-col items-center">
                              <span className="mb-0.5 text-[9px] font-bold text-emerald-700">
                                {row.completed_tasks}
                              </span>
                              <div
                                className="w-3 rounded-t bg-[#16A34A] transition-all group-hover:bg-emerald-700"
                                style={{ height: `${Math.max(4, completedHeight)}px` }}
                                title={`${row.employee_name} (${row.employee_id}) — Completed: ${row.completed_tasks}`}
                              />
                            </div>
                          </div>
                          <span className="mt-1.5 truncate text-[10px] font-semibold text-[#172B4D]">
                            {row.employee_id.replace('EMP', '')}
                          </span>
                          <span className="max-w-[44px] truncate text-[9px] text-[#64748B]">
                            {shortName}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Proportion of Employees by Capacity Tier Overview */}
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[#DFE8F2] pt-4 sm:grid-cols-12 sm:items-center">
                  <div className="sm:col-span-5">
                    <Donut
                      ariaLabel="Workload Distribution Donut"
                      centerLabel="Officers"
                      centerValue={summary.totalEmployees}
                      slices={[
                        { name: 'Balanced', value: summary.balancedWorkloads, color: '#16A34A' },
                        { name: 'Underutilized', value: summary.underutilizedOfficers, color: '#1677D2' },
                        { name: 'Near Capacity', value: summary.nearCapacityCount, color: '#F59E0B' },
                        { name: 'Overloaded', value: summary.overloadedOfficers, color: '#E53935' },
                      ]}
                    />
                  </div>
                  <div className="space-y-2.5 sm:col-span-7">
                    <h4 className="text-xs font-bold text-[#0B1F3A]">
                      Workload Distribution Overview
                    </h4>
                    {[
                      {
                        label: 'Balanced (70%–95%)',
                        count: summary.balancedWorkloads,
                        color: 'bg-[#16A34A]',
                        textColor: 'text-emerald-700',
                      },
                      {
                        label: 'Underutilized (<70%)',
                        count: summary.underutilizedOfficers,
                        color: 'bg-[#1677D2]',
                        textColor: 'text-[#1677D2]',
                      },
                      {
                        label: 'Near Capacity (96%–110%)',
                        count: summary.nearCapacityCount,
                        color: 'bg-[#F59E0B]',
                        textColor: 'text-amber-700',
                      },
                      {
                        label: 'Overloaded (>110%)',
                        count: summary.overloadedOfficers,
                        color: 'bg-[#E53935]',
                        textColor: 'text-rose-700',
                      },
                    ].map((tier) => {
                      const pct = summary.totalEmployees
                        ? Math.round((tier.count / summary.totalEmployees) * 100)
                        : 0
                      return (
                        <div key={tier.label} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[#334155]">{tier.label}</span>
                            <span className={`font-bold ${tier.textColor}`}>
                              {tier.count} staff ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${tier.color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: AI Workload Recommendations (Rule-Based Labeled) */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-5">
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-[#DFE8F2] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-[#1677D2]" />
                      <h3 className="text-sm font-bold text-[#0B1F3A]">
                        AI Workload Recommendations
                      </h3>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">
                      Actionable operational guidance from route length, capacity, and leave rules
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-[#1677D2]">
                    Rule-Based Engine
                  </span>
                </div>

                <div className="mt-3 rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#475569]">
                  <strong>Transparency Note:</strong> These workload recommendations are generated by deterministic postal capacity and route-balancing rules (not an ML workload model). No assignments are changed without Postmaster confirmation.
                </div>

                <div className="mt-3.5 space-y-3">
                  {recommendations.map((rec) => {
                    const badgeStyle =
                      rec.priority === 'High'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : rec.priority === 'Medium'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    return (
                      <article
                        key={rec.id}
                        className="rounded-xl border border-[#DFE8F2] bg-white p-3.5 shadow-2xs transition-colors hover:border-[#cbd5e1]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">
                            {rec.category}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeStyle}`}>
                            {rec.priority} Priority
                          </span>
                        </div>
                        <h4 className="mt-1 text-xs font-bold text-[#0B1F3A]">{rec.title}</h4>
                        <p className="mt-1 text-[11px] font-semibold text-[#1677D2]">
                          Affected: {rec.affected}
                        </p>
                        <p className="mt-1 text-[11px] text-[#475569]">
                          <strong>Reason:</strong> {rec.reason}
                        </p>
                        <p className="mt-1 text-[11px] text-[#172B4D]">
                          <strong>Suggested Action:</strong> {rec.suggestedAction}
                        </p>
                        <div className="mt-2.5 flex justify-end border-t border-slate-100 pt-2">
                          <button
                            type="button"
                            onClick={() => setReviewRecModal(rec)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#1677D2] bg-blue-50/70 px-2.5 py-1 text-[11px] font-bold text-[#1677D2] hover:bg-blue-100"
                          >
                            Review Recommendation
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#DFE8F2] pt-3 text-[11px] text-[#64748B]">
                <span>Requires Postmaster confirmation</span>
                <button
                  type="button"
                  disabled={!isPostmaster}
                  onClick={handleRunAutoBalance}
                  className="rounded-lg bg-[#0B1F3A] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#17355b] disabled:opacity-50"
                >
                  Open Auto-Balance Preview
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── 6. Create Allocation Drawer / Modal ────────────────────────────── */}
      {createDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-alloc-title"
        >
          <div className="flex h-full w-full max-w-lg flex-col justify-between overflow-y-auto bg-white p-6 shadow-2xl">
            <div>
              <div className="flex items-center justify-between border-b border-[#DFE8F2] pb-4">
                <div>
                  <span className="text-[10px] font-bold tracking-wider text-[#1677D2] uppercase">
                    Postmaster Operations
                  </span>
                  <h2 id="create-alloc-title" className="text-lg font-bold text-[#0B1F3A]">
                    Create Work Allocation
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Assign daily tasks and delivery routes with role-fit and duplicate validation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-[#64748B] hover:bg-slate-100 hover:text-[#0B1F3A]"
                  aria-label="Close drawer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form id="create-alloc-form" onSubmit={handleCreateAllocationSubmit} className="mt-4 space-y-3.5 text-xs">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Allocation Date */}
                  <div>
                    <label htmlFor="alloc-form-date" className="block font-semibold text-[#172B4D]">
                      Allocation Date *
                    </label>
                    <input
                      id="alloc-form-date"
                      type="date"
                      value={allocationForm.date}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, date: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                    />
                    {formErrors.date && <p className="mt-1 text-[11px] text-rose-600">{formErrors.date}</p>}
                  </div>

                  {/* Priority */}
                  <div>
                    <label htmlFor="alloc-form-priority" className="block font-semibold text-[#172B4D]">
                      Priority *
                    </label>
                    <select
                      id="alloc-form-priority"
                      value={allocationForm.priority}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, priority: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                    >
                      {PRIORITY_OPTIONS.map((pr) => (
                        <option key={pr} value={pr}>{pr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Employee Selector */}
                <div>
                  <label htmlFor="alloc-form-emp" className="block font-semibold text-[#172B4D]">
                    Employee *
                  </label>
                  <select
                    id="alloc-form-emp"
                    value={allocationForm.employee_id}
                    onChange={(e) => handleEmployeeSelectInForm(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                  >
                    <option value="">Select employee...</option>
                    {workloadRows.map((r) => (
                      <option key={r.employee_id} value={r.employee_id}>
                        {r.employee_id} — {r.employee_name} ({r.designation} · {r.workload_pct}%{r.on_leave ? ' · ON LEAVE' : ''})
                      </option>
                    ))}
                  </select>
                  {formErrors.employee_id && <p className="mt-1 text-[11px] text-rose-600">{formErrors.employee_id}</p>}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Designation (Read-only from employee profile) */}
                  <div>
                    <label htmlFor="alloc-form-desig" className="block font-semibold text-[#172B4D]">
                      Designation *
                    </label>
                    <input
                      id="alloc-form-desig"
                      type="text"
                      readOnly
                      value={allocationForm.designation}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-3 text-xs font-medium text-[#475569]"
                    />
                    {formErrors.designation && <p className="mt-1 text-[11px] text-rose-600">{formErrors.designation}</p>}
                  </div>

                  {/* Task Type */}
                  <div>
                    <label htmlFor="alloc-form-task" className="block font-semibold text-[#172B4D]">
                      Task Type *
                    </label>
                    <select
                      id="alloc-form-task"
                      value={allocationForm.task_type}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, task_type: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                    >
                      {TASK_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    {formErrors.task_type && <p className="mt-1 text-[11px] text-rose-600">{formErrors.task_type}</p>}
                  </div>
                </div>

                {/* Route ID, Route Length, and Delivery Points */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="alloc-form-route" className="block font-semibold text-[#172B4D]">
                      Route ID {selectedFormIsDelivery ? '*' : '(Optional)'}
                    </label>
                    <input
                      id="alloc-form-route"
                      type="text"
                      placeholder={selectedFormIsDelivery ? 'e.g. R61-NEG' : 'Office / Counter'}
                      value={allocationForm.route_id}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, route_id: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                    />
                    {formErrors.route_id && <p className="mt-1 text-[11px] text-rose-600">{formErrors.route_id}</p>}
                  </div>

                  <div>
                    <label htmlFor="alloc-form-km" className="block font-semibold text-[#172B4D]">
                      Route Length (km) {selectedFormIsDelivery ? '*' : ''}
                    </label>
                    <input
                      id="alloc-form-km"
                      type="number"
                      step="0.5"
                      min="0"
                      value={allocationForm.route_length_km}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, route_length_km: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                    />
                    {formErrors.route_length_km && <p className="mt-1 text-[11px] text-rose-600">{formErrors.route_length_km}</p>}
                  </div>

                  <div>
                    <label htmlFor="alloc-form-points" className="block font-semibold text-[#172B4D]">
                      Delivery Points {selectedFormIsDelivery ? '*' : ''}
                    </label>
                    <input
                      id="alloc-form-points"
                      type="number"
                      min="0"
                      value={allocationForm.delivery_points}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, delivery_points: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                    />
                    {formErrors.delivery_points && <p className="mt-1 text-[11px] text-rose-600">{formErrors.delivery_points}</p>}
                  </div>
                </div>

                {/* Assigned Tasks, Start Time, Expected Completion Time */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="alloc-form-count" className="block font-semibold text-[#172B4D]">
                      Assigned Tasks *
                    </label>
                    <input
                      id="alloc-form-count"
                      type="number"
                      min="1"
                      max="40"
                      value={allocationForm.assigned_tasks}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, assigned_tasks: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs font-bold text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                    />
                    {formErrors.assigned_tasks && <p className="mt-1 text-[11px] text-rose-600">{formErrors.assigned_tasks}</p>}
                  </div>

                  <div>
                    <label htmlFor="alloc-form-start" className="block font-semibold text-[#172B4D]">
                      Start Time *
                    </label>
                    <input
                      id="alloc-form-start"
                      type="time"
                      value={allocationForm.start_time}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, start_time: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="alloc-form-end" className="block font-semibold text-[#172B4D]">
                      Expected Completion *
                    </label>
                    <input
                      id="alloc-form-end"
                      type="time"
                      value={allocationForm.expected_completion_time}
                      onChange={(e) => setAllocationForm((p) => ({ ...p, expected_completion_time: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                    />
                    {formErrors.expected_completion_time && (
                      <p className="mt-1 text-[11px] text-rose-600">{formErrors.expected_completion_time}</p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="alloc-form-notes" className="block font-semibold text-[#172B4D]">
                    Operational Notes
                  </label>
                  <textarea
                    id="alloc-form-notes"
                    rows={3}
                    placeholder="Add route instructions, special handling notes, or shift handover remarks..."
                    value={allocationForm.notes}
                    onChange={(e) => setAllocationForm((p) => ({ ...p, notes: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#DFE8F2] p-2.5 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
                  />
                </div>

                {formErrors.duplicate_warning && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
                    {formErrors.duplicate_warning}
                  </div>
                )}
              </form>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#DFE8F2] pt-4">
              <button
                type="button"
                onClick={() => setCreateDrawerOpen(false)}
                className="h-9 rounded-xl border border-[#DFE8F2] px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-alloc-form"
                disabled={saving}
                className="h-9 rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#125ea7] disabled:opacity-50"
              >
                {saving ? 'Saving Allocation...' : 'Save Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Auto-Balance Workload Modal (Before & After Preview) ────────── */}
      {autoBalanceOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="autobalance-title"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#DFE8F2] pb-4">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-[#1677D2] uppercase">
                  Automated Capacity Optimization
                </span>
                <h2 id="autobalance-title" className="text-lg font-bold text-[#0B1F3A]">
                  {autoBalancing ? 'Balancing Workload...' : 'Auto-Balance Workload'} Preview ({selectedDate})
                </h2>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  Calculated from verified employee attendance, approved leave, pending tasks, route distance, and role-fit capacity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoBalanceOpen(false)}
                className="rounded-lg p-1.5 text-[#64748B] hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Attendance Missing Alert & Instant Fallback */}
            {(autoBalanceResult?.attendance_missing || (!workloadRows.some((r) => r.is_eligible) && unrecordedOfficers.length > 0)) ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <AlertTriangle className="size-5" />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-amber-950">
                      Attendance Verification Required
                    </h3>
                    <p className="mt-1 text-xs text-amber-800">
                      Attendance records have not been recorded for officers on <strong>{selectedDate}</strong>. Under Sri Lanka Postal Department Policy, officers are excluded until attendance is verified. You can authorize active staff below to generate the workload allocation plan.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={autoBalancing}
                        onClick={handleAuthorizeAndAutoBalance}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#125ea7] disabled:opacity-50"
                      >
                        <Zap className="size-3.5" />
                        {autoBalancing ? 'Authorizing & Balancing...' : 'Authorize Active Staff & Auto-Balance'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAutoBalanceOpen(false)
                          handleOpenAuthModal()
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                      >
                        <CheckSquare className="size-3.5" />
                        Select Staff to Authorize...
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : autoBalanceResult && (
              <div
                className={`mt-3 flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                  autoBalanceResult.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                {autoBalanceResult.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{autoBalanceResult.message}</p>
                  <p className="mt-0.5 text-[11px] opacity-90">
                    Allocation Date: {autoBalanceResult.date} · {autoBalanceResult.tasks_assigned || 0} task(s) proposed · {autoBalanceResult.eligible_count || 0} eligible attending officer(s) · {autoBalanceResult.unassigned_count || 0} unassigned
                  </p>
                </div>
              </div>
            )}

            {/* Before vs After Summary Comparison */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3">
                <span className="text-[10px] font-semibold text-[#64748B] uppercase">Overloaded Officers</span>
                <p className="mt-1 text-base font-extrabold text-[#0B1F3A]">
                  <span className="text-rose-600">{autoBalancePreview.beforeSummary.overloadedOfficers}</span>
                  {' → '}
                  <span className="text-emerald-700">{autoBalanceResult?.overloaded_count ?? autoBalancePreview.afterSummary.overloadedOfficers}</span>
                </p>
              </div>
              <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3">
                <span className="text-[10px] font-semibold text-[#64748B] uppercase">Balanced Workloads</span>
                <p className="mt-1 text-base font-extrabold text-[#0B1F3A]">
                  <span>{autoBalancePreview.beforeSummary.balancedWorkloads}</span>
                  {' → '}
                  <span className="text-emerald-700">{autoBalanceResult?.balanced_count ?? autoBalancePreview.afterSummary.balancedWorkloads}</span>
                </p>
              </div>
              <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3">
                <span className="text-[10px] font-semibold text-[#64748B] uppercase">Underutilized Staff</span>
                <p className="mt-1 text-base font-extrabold text-[#0B1F3A]">
                  <span>{autoBalancePreview.beforeSummary.underutilizedOfficers}</span>
                  {' → '}
                  <span className="text-[#1677D2]">{autoBalanceResult?.underutilized_count ?? autoBalancePreview.afterSummary.underutilizedOfficers}</span>
                </p>
              </div>
              <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3">
                <span className="text-[10px] font-semibold text-[#64748B] uppercase">Proposed Transfers</span>
                <p className="mt-1 text-base font-extrabold text-[#1677D2]">
                  {(autoBalanceResult?.transfers?.length ?? autoBalancePreview.transfers.length)} move(s)
                </p>
              </div>
            </div>

            {/* Proposed Employee Workload Distribution Table */}
            {autoBalanceResult?.eligible_employees && autoBalanceResult.eligible_employees.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#0B1F3A]">
                    Employee Workload Distribution (Proposed Allocation Breakdown)
                  </h3>
                  <span className="text-[10px] text-[#64748B]">
                    {autoBalanceResult.eligible_employees.length} eligible officer(s) on duty
                  </span>
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#DFE8F2]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#DFE8F2] bg-[#F8FAFC] text-[10px] font-bold text-[#64748B] uppercase sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Officer</th>
                        <th className="py-2.5 px-3">Role &amp; Department</th>
                        <th className="py-2.5 px-3 text-center">Current Tasks</th>
                        <th className="py-2.5 px-3 text-center">Proposed Tasks</th>
                        <th className="py-2.5 px-3 text-center">Workload %</th>
                        <th className="py-2.5 px-3">Proposed Status</th>
                        <th className="py-2.5 px-3">Assigned Tasks / Policy Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE8F2]">
                      {autoBalanceResult.eligible_employees.map((emp) => {
                        const newTasks = (autoBalanceResult.transfers || [])
                          .filter((t) => t.to_employee_id === emp.employee_id)
                          .map((t) => t.task || t.task_type)
                        const taskDiff = (emp.after_assigned ?? emp.assigned_tasks) - (emp.before_assigned ?? 0)
                        const statusBadge =
                          emp.workload_status === 'Overloaded'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : emp.workload_status === 'Near Capacity'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : emp.workload_status === 'Balanced'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-[#1677D2] border-blue-200'

                        return (
                          <tr key={emp.employee_id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-[#0B1F3A]">{emp.employee_name}</div>
                              <span className="font-mono text-[10px] text-[#64748B]">{emp.employee_id}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-[#172B4D]">{emp.designation}</div>
                              <div className="text-[10px] text-[#64748B]">{emp.work_category}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-medium text-[#475569]">
                              {emp.before_assigned ?? 0}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="font-bold text-[#0B1F3A]">
                                {emp.after_assigned ?? emp.assigned_tasks}
                              </span>
                              {taskDiff > 0 && (
                                <span className="ml-1 text-[10px] font-bold text-emerald-600">
                                  (+{taskDiff})
                                </span>
                              )}
                              {taskDiff < 0 && (
                                <span className="ml-1 text-[10px] font-bold text-rose-600">
                                  ({taskDiff})
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="font-bold text-[#1677D2]">{emp.workload_pct}%</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadge}`}>
                                {emp.workload_status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {newTasks.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {newTasks.map((tName, tIdx) => (
                                    <span
                                      key={tIdx}
                                      className="inline-block rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-medium text-[#1677D2]"
                                    >
                                      {tName}
                                    </span>
                                  ))}
                                </div>
                              ) : (emp.after_assigned ?? emp.assigned_tasks) > 0 ? (
                                <span className="text-[11px] text-[#64748B]">
                                  Retained existing assigned work ({emp.after_assigned ?? emp.assigned_tasks} task)
                                </span>
                              ) : (
                                <span className="text-[11px] text-amber-700">
                                  {emp.allocation_note || 'Shortage of matching operational tasks for this role'}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Attendance Transparency: Excluded Staff List */}
            {((autoBalanceResult?.excluded_employees && autoBalanceResult.excluded_employees.length > 0) || workloadRows.filter((r) => !r.is_eligible).length > 0) && (
              <div className="mt-4">
                <h3 className="text-xs font-bold text-[#0B1F3A]">
                  Excluded Officers (Attendance & Leave Policy)
                </h3>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[#DFE8F2]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#DFE8F2] bg-[#F8FAFC] text-[10px] font-bold text-[#64748B] uppercase">
                      <tr>
                        <th className="py-2 px-3">Officer</th>
                        <th className="py-2 px-3">Designation</th>
                        <th className="py-2 px-3">Attendance Eligibility</th>
                        <th className="py-2 px-3">Policy Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE8F2]">
                      {(autoBalanceResult?.excluded_employees || workloadRows.filter((r) => !r.is_eligible).map((r) => ({
                        employee_id: r.employee_id,
                        employee_name: r.employee_name,
                        designation: r.designation,
                        reason: r.eligibility_tag,
                        details: r.eligibility_reason,
                      }))).map((ex, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-[#0B1F3A]">
                            {ex.employee_name} <span className="font-mono text-[10px] text-[#64748B]">({ex.employee_id})</span>
                          </td>
                          <td className="py-2 px-3 text-[#475569]">{ex.designation}</td>
                          <td className="py-2 px-3">
                            <span className="rounded bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              {ex.reason}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-[#64748B]">{ex.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transfers Table */}
            <div className="mt-4">
              <h3 className="text-xs font-bold text-[#0B1F3A]">
                Proposed Task Reassignments (Before → After)
              </h3>
              {(autoBalanceResult?.attendance_missing || (!workloadRows.some((r) => r.is_eligible) && unrecordedOfficers.length > 0)) ? (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900">
                  <p className="font-bold">No eligible employees are currently available for allocation on this date.</p>
                  <p className="mt-1 text-[11px] text-amber-800">
                    Please authorize staff attendance above to unlock automated workload balancing.
                  </p>
                </div>
              ) : (autoBalanceResult?.transfers?.length ?? autoBalancePreview.transfers.length) === 0 ? (
                <p className="mt-2 rounded-xl border border-[#DFE8F2] bg-slate-50 p-4 text-xs text-[#64748B]">
                  All active officers are already balanced within acceptable thresholds. No transfers required.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-xl border border-[#DFE8F2]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#DFE8F2] bg-[#F8FAFC] text-[10px] font-bold text-[#64748B] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">From Officer / Source</th>
                        <th className="py-2.5 px-3">To Officer</th>
                        <th className="py-2.5 px-3">Assigned Task & Role Fit</th>
                        <th className="py-2.5 px-3 text-center">Tasks Moved</th>
                        <th className="py-2.5 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE8F2]">
                      {(autoBalanceResult?.transfers || autoBalancePreview.transfers).map((tr, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#0B1F3A]">{tr.from_employee_name}</div>
                            <div className="text-[10px] text-[#64748B]">{tr.from_employee_id} {tr.from_designation ? `· ${tr.from_designation}` : ''}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#0B1F3A]">{tr.to_employee_name}</div>
                            <div className="text-[10px] text-[#64748B]">{tr.to_employee_id} · {tr.to_designation || tr.designation}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#0B1F3A]">{tr.task || tr.task_type}</div>
                            <div className="text-[10px] text-[#64748B]">{tr.work_category} {tr.route_id ? `· Route ${tr.route_id}` : ''}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-[#1677D2]">
                            +{tr.tasks_moved || 1}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-[#475569]">{tr.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#DFE8F2] pt-4">
              <span className="text-[11px] text-[#64748B]">
                {autoBalanceResult?.confirmed ? 'Assignments are safely persisted to MongoDB.' : 'Postmaster confirmation is required before saving any reassignment.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoBalanceOpen(false)}
                  className="h-9 rounded-xl border border-[#DFE8F2] px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={
                    saving ||
                    autoBalancing ||
                    autoBalanceResult?.attendance_missing ||
                    (!autoBalanceResult?.transfers?.length && autoBalancePreview.transfers.length === 0)
                  }
                  onClick={handleConfirmAutoBalance}
                  className="h-9 rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#125ea7] disabled:opacity-50"
                >
                  {saving ? 'Applying Rebalance...' : 'Confirm & Save Reassignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Attendance Authorization Modal (Postmaster Fallback) ───────────── */}
      {authAttendanceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#DFE8F2] pb-4">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-[#1677D2] uppercase">
                  Postal Attendance & Availability Policy
                </span>
                <h2 className="text-lg font-bold text-[#0B1F3A]">
                  Authorize Staff Attendance ({selectedDate})
                </h2>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  Select available officers to authorize for work allocation on this date.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthAttendanceModalOpen(false)}
                className="rounded-lg p-1.5 text-[#64748B] hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-[#0B1F3A]">Attendance Capacity & Status</label>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAuthStatusChoice('Present')}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    authStatusChoice === 'Present'
                      ? 'border-[#1677D2] bg-blue-50/50 ring-2 ring-[#1677D2]/20'
                      : 'border-[#DFE8F2] hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold text-[#0B1F3A]">Present (Full Day)</span>
                  <span className="mt-0.5 text-[11px] text-[#64748B]">Standard capacity: 5 task batches (100%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthStatusChoice('Half Day')}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    authStatusChoice === 'Half Day'
                      ? 'border-[#1677D2] bg-blue-50/50 ring-2 ring-[#1677D2]/20'
                      : 'border-[#DFE8F2] hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold text-[#0B1F3A]">Present (Half Day)</span>
                  <span className="mt-0.5 text-[11px] text-[#64748B]">Adjusted capacity: 3 task batches (50%)</span>
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0B1F3A]">Select Officers to Authorize</label>
                <button
                  type="button"
                  onClick={() => {
                    const allIds = workloadRows.filter((r) => !r.on_leave).map((r) => r.employee_id)
                    setSelectedOfficersToAuth((prev) => (prev.length === allIds.length ? [] : allIds))
                  }}
                  className="text-xs font-semibold text-[#1677D2] hover:underline"
                >
                  {selectedOfficersToAuth.length === workloadRows.filter((r) => !r.on_leave).length ? 'Deselect All' : 'Select All Active'}
                </button>
              </div>

              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-[#DFE8F2] divide-y divide-[#DFE8F2]">
                {workloadRows.map((emp) => {
                  const isChecked = selectedOfficersToAuth.includes(emp.employee_id)
                  const isDisabled = emp.on_leave
                  return (
                    <label
                      key={emp.employee_id}
                      className={`flex items-center justify-between p-3 transition ${
                        isDisabled ? 'bg-slate-50 opacity-60 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={isDisabled}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOfficersToAuth((prev) => [...prev, emp.employee_id])
                            } else {
                              setSelectedOfficersToAuth((prev) => prev.filter((id) => id !== emp.employee_id))
                            }
                          }}
                          className="size-4 rounded border-[#DFE8F2] text-[#1677D2] focus:ring-[#1677D2]"
                        />
                        <div>
                          <div className="text-xs font-bold text-[#0B1F3A]">{emp.employee_name}</div>
                          <div className="text-[10px] text-[#64748B]">{emp.employee_id} · {emp.designation} · {emp.work_category}</div>
                        </div>
                      </div>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${emp.eligibility_class}`}>
                        {emp.eligibility_tag}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-[#0B1F3A]">Postmaster Authorization Note</label>
              <input
                type="text"
                value={authNotes}
                onChange={(e) => setAuthNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#DFE8F2] px-3 py-2 text-xs text-[#0B1F3A] focus:border-[#1677D2] focus:outline-hidden"
                placeholder="Reason or authorization reference..."
              />
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#DFE8F2] pt-4">
              <span className="text-[11px] text-[#64748B]">
                {selectedOfficersToAuth.length} officer{selectedOfficersToAuth.length === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuthAttendanceModalOpen(false)}
                  className="h-9 rounded-xl border border-[#DFE8F2] px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={authorizingAttendance || selectedOfficersToAuth.length === 0}
                  onClick={handleSubmitAttendanceAuth}
                  className="h-9 rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#125ea7] disabled:opacity-50"
                >
                  {authorizingAttendance ? 'Authorizing...' : 'Authorize Selected Staff'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Employee View Details Modal ────────────────────────────────────── */}
      {detailEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#DFE8F2] pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-[#1677D2]">{detailEmployee.employee_id}</span>
                <h3 className="text-base font-bold text-[#0B1F3A]">{detailEmployee.employee_name}</h3>
                <p className="text-xs text-[#64748B]">
                  {detailEmployee.designation} · {detailEmployee.work_category} · {detailEmployee.post_office}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailEmployee(null)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-[#F8FAFC] p-3">
                <span className="text-[10px] text-[#64748B]">Workload Percentage</span>
                <p className="mt-0.5 text-base font-extrabold text-[#0B1F3A]">{detailEmployee.workload_pct}%</p>
                <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${detailEmployee.status_badge_class}`}>
                  {detailEmployee.workload_status}
                </span>
              </div>
              <div className="rounded-xl bg-[#F8FAFC] p-3">
                <span className="text-[10px] text-[#64748B]">Availability Status</span>
                <p className="mt-0.5 text-sm font-bold text-[#0B1F3A]">{detailEmployee.availability}</p>
                <span className="text-[10px] text-[#64748B]">Shift: {detailEmployee.start_time} – {detailEmployee.expected_completion_time}</span>
              </div>
              <div className="rounded-xl bg-[#F8FAFC] p-3">
                <span className="text-[10px] text-[#64748B]">Assigned / Completed / Pending</span>
                <p className="mt-0.5 text-sm font-bold text-[#0B1F3A]">
                  {detailEmployee.assigned_tasks} assigned · {detailEmployee.completed_tasks} done · {detailEmployee.pending_tasks} pending
                </p>
              </div>
              <div className="rounded-xl bg-[#F8FAFC] p-3">
                <span className="text-[10px] text-[#64748B]">Attendance Eligibility</span>
                <div className="mt-0.5">
                  <span className={`inline-block rounded border px-1.5 py-0.2 text-[10px] font-bold ${detailEmployee.eligibility_class || 'bg-slate-100 text-[#64748B]'}`}>
                    {detailEmployee.eligibility_tag || 'Attendance Not Recorded — Excluded'}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-[#64748B]">{detailEmployee.eligibility_reason}</p>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] p-3">
                <span className="text-[10px] text-[#64748B]">Route & Task</span>
                <p className="mt-0.5 text-xs font-bold text-[#0B1F3A]">{detailEmployee.primary_task_type}</p>
                {detailEmployee.route_id && (
                  <span className="text-[10px] text-[#64748B]">
                    {detailEmployee.route_id} · {detailEmployee.route_length_km} km (~{detailEmployee.delivery_points} pts)
                  </span>
                )}
              </div>
            </div>

            {/* Itemized Assigned Tasks Checklist */}
            {renderEmployeeTasksChecklist(detailEmployee, true)}

            <div className="mt-5 flex justify-end gap-2 border-t border-[#DFE8F2] pt-3">
              <button
                type="button"
                onClick={() => setDetailEmployee(null)}
                className="h-8 rounded-lg border border-[#DFE8F2] px-3 text-xs font-semibold text-[#475569]"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!isPostmaster}
                onClick={() => {
                  const emp = detailEmployee
                  setDetailEmployee(null)
                  openCreateDrawerFor(emp)
                }}
                className="h-8 rounded-lg bg-[#1677D2] px-3 text-xs font-bold text-white hover:bg-[#125ea7]"
              >
                Edit Allocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reassign Work Modal ────────────────────────────────────────────── */}
      {reassignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmReassign}
            className="w-full max-w-md rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-[#DFE8F2] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#1677D2] uppercase">Postmaster Reassignment</span>
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Reassign Work from {reassignModal.fromRow.employee_name}
                </h3>
                <p className="text-xs text-[#64748B]">
                  Current load: {reassignModal.fromRow.workload_pct}% ({reassignModal.fromRow.assigned_tasks} assigned, {reassignModal.fromRow.pending_tasks} pending)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReassignModal(null)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label htmlFor="reassign-to" className="block font-semibold text-[#172B4D]">
                  Target Receiving Officer *
                </label>
                <select
                  id="reassign-to"
                  required
                  value={reassignModal.toEmployeeId}
                  onChange={(e) => setReassignModal((p) => ({ ...p, toEmployeeId: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A]"
                >
                  <option value="">Select available colleague...</option>
                  {workloadRows
                    .filter((r) => r.employee_id !== reassignModal.fromRow.employee_id && !r.on_leave)
                    .map((r) => (
                      <option key={r.employee_id} value={r.employee_id}>
                        {r.employee_id} — {r.employee_name} ({r.designation} · {r.workload_pct}%)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="reassign-count" className="block font-semibold text-[#172B4D]">
                  Number of Tasks to Reassign *
                </label>
                <input
                  id="reassign-count"
                  type="number"
                  min="1"
                  max={Math.max(1, reassignModal.fromRow.assigned_tasks)}
                  value={reassignModal.transferCount}
                  onChange={(e) => setReassignModal((p) => ({ ...p, transferCount: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs font-bold text-[#0B1F3A]"
                />
              </div>

              <div>
                <label htmlFor="reassign-reason" className="block font-semibold text-[#172B4D]">
                  Reason / Handover Note
                </label>
                <input
                  id="reassign-reason"
                  type="text"
                  value={reassignModal.reason}
                  onChange={(e) => setReassignModal((p) => ({ ...p, reason: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-[#DFE8F2] pt-3">
              <button
                type="button"
                onClick={() => setReassignModal(null)}
                className="h-9 rounded-xl border border-[#DFE8F2] px-3.5 text-xs font-semibold text-[#475569]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white hover:bg-[#125ea7] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Confirm Reassignment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Review Recommendation Modal ────────────────────────────────────── */}
      {reviewRecModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#DFE8F2] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#1677D2] uppercase">
                  {reviewRecModal.category} · {reviewRecModal.priority} Priority
                </span>
                <h3 className="text-base font-bold text-[#0B1F3A]">{reviewRecModal.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewRecModal(null)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-[#334155]">
              <p>
                <strong className="text-[#0B1F3A]">Affected Officer / Route:</strong> {reviewRecModal.affected}
              </p>
              <p>
                <strong className="text-[#0B1F3A]">Operational Reason:</strong> {reviewRecModal.reason}
              </p>
              <p className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[#0B1F3A]">
                <strong>Suggested Action:</strong> {reviewRecModal.suggestedAction}
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-[#DFE8F2] pt-3">
              <button
                type="button"
                onClick={() => setReviewRecModal(null)}
                className="h-9 rounded-xl border border-[#DFE8F2] px-3.5 text-xs font-semibold text-[#475569]"
              >
                Close
              </button>
              {reviewRecModal.fromEmployeeId ? (
                <button
                  type="button"
                  disabled={!isPostmaster}
                  onClick={() => {
                    const fromRow = workloadRows.find((r) => r.employee_id === reviewRecModal.fromEmployeeId)
                    setReviewRecModal(null)
                    if (fromRow) {
                      setReassignModal({
                        fromRow,
                        toEmployeeId: reviewRecModal.toEmployeeId || '',
                        transferCount: reviewRecModal.transferCount || 1,
                        reason: reviewRecModal.title,
                      })
                    }
                  }}
                  className="h-9 rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white hover:bg-[#125ea7]"
                >
                  Open Reassignment Form
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNotice(`Acknowledged recommendation: "${reviewRecModal.title}".`)
                    setReviewRecModal(null)
                  }}
                  className="h-9 rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white hover:bg-[#125ea7]"
                >
                  Acknowledge Rule
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
