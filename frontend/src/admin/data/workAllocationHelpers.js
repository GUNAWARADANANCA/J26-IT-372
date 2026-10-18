/**
 * Pure calculation, validation, and auto-balancing helpers for the
 * Work Allocation – Plan and Balance Workload page.
 */

export const DEFAULT_DAILY_TARGET_TASKS = 5

export const TASK_ROLE_FIT = {
  'Mail & Parcel Delivery': {
    roles: ['Postman', 'Senior Postman', 'Delivery Officer'],
    categories: ['Delivery (Field)'],
    isDelivery: true,
  },
  'Registered Mail Delivery': {
    roles: ['Postman', 'Senior Postman', 'Delivery Officer'],
    categories: ['Delivery (Field)'],
    isDelivery: true,
  },
  'Parcel Delivery by Route': {
    roles: ['Postman', 'Senior Postman', 'Delivery Officer'],
    categories: ['Delivery (Field)'],
    isDelivery: true,
  },
  'Ordinary Letter Delivery': {
    roles: ['Postman', 'Senior Postman', 'Delivery Officer'],
    categories: ['Delivery (Field)'],
    isDelivery: true,
  },
  'Customer Service Counter': {
    roles: ['Postal Assistant', 'Postal Clerk'],
    categories: ['Office'],
    isDelivery: false,
  },
  'Money Order Processing': {
    roles: ['Postal Assistant', 'Postal Clerk'],
    categories: ['Office'],
    isDelivery: false,
  },
  'Postal Clerk Duties': {
    roles: ['Postal Clerk', 'Postmaster (Head)'],
    categories: ['Office', 'Supervisory / Office'],
    isDelivery: false,
  },
  'Data Entry': {
    roles: ['Postal Assistant', 'Postal Clerk'],
    categories: ['Office'],
    isDelivery: false,
  },
  'Accounts Processing': {
    roles: ['Postal Assistant', 'Postal Clerk'],
    categories: ['Office'],
    isDelivery: false,
  },
  'Accounts Verification': {
    roles: ['Postmaster (Head)'],
    categories: ['Supervisory / Office'],
    isDelivery: false,
  },
  'Correspondence Handling': {
    roles: ['Postal Assistant', 'Postal Clerk'],
    categories: ['Office'],
    isDelivery: false,
  },
  'Communication Support': {
    roles: ['Postal Assistant', 'Postal Clerk'],
    categories: ['Office'],
    isDelivery: false,
  },
  'Stock & Inventory Check': {
    roles: ['Postal Assistant', 'Postal Clerk'],
    categories: ['Office'],
    isDelivery: false,
  },
  'Workflow Coordination': {
    roles: ['Postal Assistant', 'Postal Clerk'],
    categories: ['Office'],
    isDelivery: false,
  },
  'Team Coordination': {
    roles: ['Postal Assistant', 'Postal Clerk'],
    categories: ['Office'],
    isDelivery: false,
  },
  'Approvals & Audit': {
    roles: ['Postmaster (Head)'],
    categories: ['Supervisory / Office'],
    isDelivery: false,
  },
  'Staff Performance Review': {
    roles: ['Postmaster (Head)'],
    categories: ['Supervisory / Office'],
    isDelivery: false,
  },
  'Work Allocation & Supervision': {
    roles: ['Postmaster (Head)'],
    categories: ['Supervisory / Office'],
    isDelivery: false,
  },
}

function toNum(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Determine workload status and badge tone from workload percentage.
 * - Underutilized: < 70%
 * - Balanced: 70% to 95%
 * - Near Capacity: 96% to 110%
 * - Overloaded: > 110%
 */
export function classifyWorkloadStatus(workloadPct) {
  const pct = toNum(workloadPct, 0)
  if (pct > 110) {
    return {
      status: 'Overloaded',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      barColor: '#E53935',
    }
  }
  if (pct >= 96) {
    return {
      status: 'Near Capacity',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      barColor: '#F59E0B',
    }
  }
  if (pct >= 70) {
    return {
      status: 'Balanced',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      barColor: '#16A34A',
    }
  }
  return {
    status: 'Underutilized',
    badgeClass: 'bg-blue-50 text-[#1677D2] border-blue-200',
    barColor: '#1677D2',
  }
}

/**
 * Check if an employee has approved leave overlapping the selected date.
 */
export function isEmployeeOnApprovedLeave(employeeId, dateStr, leaves = []) {
  if (!employeeId) return false
  for (const row of leaves || []) {
    const id = row.employee_id || row.name
    if (id !== employeeId) continue
    const status = String(row.status || '').trim().toLowerCase()
    if (status !== 'approved') continue
    const from = String(row.from_date || '').slice(0, 10)
    const to = String(row.to_date || '').slice(0, 10)
    if (from && to && dateStr) {
      if (from <= dateStr && dateStr <= to) return true
    } else if (!from && !to) {
      // Undated approved leave record on file
      return true
    }
  }
  return false
}

/**
 * Build unified workload rows for all employees on a selected date.
 * If the selected date has no daily_kpi_log entries for an employee, falls back
 * to the employee's latest recorded daily_kpi_log snapshot so the Postmaster
 * can inspect and plan from real baseline route/task profiles, while marking
 * whether the row is a live date log or baseline profile.
 */
export function buildEmployeeWorkloadRows({
  employees = [],
  allLogs = [],
  attendanceForDate = [],
  leaves = [],
  selectedDate = '',
  targetTasks = DEFAULT_DAILY_TARGET_TASKS,
}) {
  const logsOnDate = new Map()
  const latestLogByEmp = new Map()

  for (const log of allLogs || []) {
    const empId = log.employee_id
    if (!empId) continue
    if (log.date === selectedDate) {
      logsOnDate.set(empId, log)
    }
    const prev = latestLogByEmp.get(empId)
    if (!prev || String(log.date || '') > String(prev.date || '')) {
      latestLogByEmp.set(empId, log)
    }
  }

  const hasAnyLogsOnDate = logsOnDate.size > 0
  const presentMap = new Map()
  for (const att of attendanceForDate || []) {
    const empId = att.employee_id
    if (!empId) continue
    presentMap.set(empId, att)
  }

  return (employees || [])
    .map((emp) => {
      const empId = emp.employee_id || emp._id || emp.name
      const directLog = logsOnDate.get(empId)
      const fallbackLog = latestLogByEmp.get(empId)
      const activeLog = directLog || (!hasAnyLogsOnDate ? fallbackLog : null)

      const assigned = activeLog ? Math.max(0, Math.round(toNum(activeLog.assigned_work_count, 0))) : 0
      const completed = activeLog ? Math.max(0, Math.round(toNum(activeLog.completed_work_count, 0))) : 0
      const rawPending =
        activeLog && activeLog.uncompleted_work_count !== undefined && activeLog.uncompleted_work_count !== null && activeLog.uncompleted_work_count !== ''
          ? Math.round(toNum(activeLog.uncompleted_work_count, assigned - completed))
          : Math.max(0, assigned - completed)
      const pending = Math.max(0, rawPending)

      const routeLengthKm = toNum(activeLog?.route_length_km ?? fallbackLog?.route_length_km, 0)
      const deliveryPoints = toNum(
        activeLog?.delivery_points ?? fallbackLog?.delivery_points,
        routeLengthKm > 0 ? Math.round(routeLengthKm * 12) : 0,
      )
      const routeId = activeLog?.route_id || fallbackLog?.route_id || ''
      const primaryTask = activeLog?.primary_task_type || fallbackLog?.primary_task_type || (emp.work_category === 'Delivery (Field)' ? 'Mail & Parcel Delivery' : 'Customer Service Counter')
      const priority = activeLog?.priority || (pending >= 2 || routeLengthKm >= 22 ? 'High' : 'Normal')

      // Compute workload % from assigned tasks vs daily target plus route length factor
      const routeBonusPct = routeLengthKm >= 22 ? 12 : routeLengthKm >= 16 ? 5 : 0
      const basePct = targetTasks > 0 ? Math.round((assigned / targetTasks) * 100) : 0
      const workloadPct = assigned === 0 ? 0 : Math.min(160, basePct + routeBonusPct)

      const { status, badgeClass, barColor } = classifyWorkloadStatus(workloadPct)
      const onLeave = isEmployeeOnApprovedLeave(empId, selectedDate, leaves)
      const attRecord = presentMap.get(empId)
      const availability = onLeave
        ? 'On Approved Leave'
        : attRecord
          ? attRecord.attendance_status || 'Present'
          : 'Available'

      return {
        employee_id: empId,
        employee_name: emp.employee_name || empId,
        designation: emp.designation || 'Staff',
        work_category: emp.work_category || 'Office',
        post_office: emp.post_office || 'Kaduwela',
        assigned_tasks: assigned,
        completed_tasks: completed,
        pending_tasks: pending,
        target_tasks: targetTasks,
        workload_pct: workloadPct,
        workload_status: status,
        status_badge_class: badgeClass,
        bar_color: barColor,
        availability,
        on_leave: onLeave,
        route_id: routeId,
        route_length_km: routeLengthKm,
        delivery_points: deliveryPoints,
        primary_task_type: primaryTask,
        priority,
        start_time: activeLog?.start_time || '08:00',
        expected_completion_time: activeLog?.expected_completion_time || '16:30',
        notes: activeLog?.notes || '',
        source_date: directLog ? selectedDate : fallbackLog?.date || '',
        is_live_date_log: Boolean(directLog),
        raw_log: directLog || null,
      }
    })
    .sort((a, b) => String(a.employee_id).localeCompare(String(b.employee_id)))
}

/**
 * Calculate the 5 KPI Summary Card values from employee workload rows and backend plan.
 */
export function calculateWorkloadSummaryCards(rows = [], backendPlan = null) {
  const totalEmployees = rows.length
  const totalAssignedTasks = rows.reduce((sum, r) => sum + r.assigned_tasks, 0)
  const totalCompletedTasks = rows.reduce((sum, r) => sum + r.completed_tasks, 0)
  const totalPendingTasks = rows.reduce((sum, r) => sum + r.pending_tasks, 0)

  const unmetCount =
    (backendPlan?.unmet?.reduce((s, u) => s + toNum(u.count, 1), 0) || 0) +
    (backendPlan?.checklist_unmet?.length || 0)

  const unassignedTasks = unmetCount > 0 ? unmetCount : totalPendingTasks

  const balancedWorkloads = rows.filter((r) => r.workload_status === 'Balanced').length
  const nearCapacityCount = rows.filter((r) => r.workload_status === 'Near Capacity').length
  const overloadedOfficers = rows.filter((r) => r.workload_status === 'Overloaded').length
  const underutilizedOfficers = rows.filter((r) => r.workload_status === 'Underutilized').length

  const employeesWithAssignedTasks = rows.filter((r) => r.assigned_tasks > 0).length

  return {
    totalEmployees,
    totalAssignedTasks,
    totalCompletedTasks,
    totalPendingTasks,
    employeesWithAssignedTasks,
    unassignedTasks,
    balancedWorkloads,
    nearCapacityCount,
    overloadedOfficers,
    underutilizedOfficers,
  }
}

/**
 * Generate rule-based operational workload recommendations from real employee rows.
 */
export function generateWorkloadRecommendations(rows = []) {
  const recommendations = []

  const overloaded = rows.filter((r) => r.workload_status === 'Overloaded' || r.workload_status === 'Near Capacity')
  const underutilized = rows.filter((r) => r.workload_status === 'Underutilized' && !r.on_leave)
  const longRoutes = rows.filter((r) => r.route_length_km >= 24)
  const onLeaveWithWork = rows.filter((r) => r.on_leave && r.assigned_tasks > 0)
  const highPending = rows.filter((r) => r.pending_tasks >= 2)

  // 1. Redistribute from overloaded to underutilized
  if (overloaded.length > 0) {
    const topOver = overloaded.sort((a, b) => b.workload_pct - a.workload_pct)[0]
    const receiver = underutilized.find((u) => u.work_category === topOver.work_category) || underutilized[0]
    recommendations.push({
      id: 'REC-REDISTRIBUTE',
      category: 'Capacity Rebalancing',
      priority: 'High',
      title: 'Redistribute tasks from overloaded officers to staff with available capacity',
      affected: `${topOver.employee_name} (${topOver.employee_id}${topOver.route_id ? ` · ${topOver.route_id}` : ''})`,
      reason: `${topOver.employee_name} is at ${topOver.workload_pct}% workload (${topOver.assigned_tasks} assigned tasks${topOver.route_length_km ? `, ${topOver.route_length_km} km route` : ''}), while ${receiver ? `${receiver.employee_name} (${receiver.employee_id}) is at ${receiver.workload_pct}%` : 'other staff have spare capacity'}.`,
      suggestedAction: receiver
        ? `Transfer 1–2 pending tasks from ${topOver.employee_name} to ${receiver.employee_name} (${receiver.designation}).`
        : `Reassign 1–2 tasks from ${topOver.employee_name} to an available colleague in ${topOver.work_category}.`,
      fromEmployeeId: topOver.employee_id,
      toEmployeeId: receiver?.employee_id || '',
      transferCount: 1,
    })
  }

  // 2. Balance delivery routes based on route length and delivery points
  if (longRoutes.length > 0) {
    const longest = [...longRoutes].sort((a, b) => b.route_length_km - a.route_length_km)[0]
    const shortRouteColleague = rows
      .filter((r) => r.work_category === 'Delivery (Field)' && r.route_length_km > 0 && r.route_length_km <= 12 && !r.on_leave)
      .sort((a, b) => a.route_length_km - b.route_length_km)[0]
    recommendations.push({
      id: 'REC-ROUTE-BALANCE',
      category: 'Route Optimization',
      priority: 'Medium',
      title: 'Balance delivery routes based on route length and delivery-point density',
      affected: `Route ${longest.route_id || 'Delivery'} · ${longest.employee_name} (${longest.route_length_km} km, ~${longest.delivery_points} delivery points)`,
      reason: `Route ${longest.route_id} spans ${longest.route_length_km} km with ${longest.assigned_tasks} assigned task batches${shortRouteColleague ? `, compared to ${shortRouteColleague.route_id} (${shortRouteColleague.route_length_km} km)` : ''}.`,
      suggestedAction: shortRouteColleague
        ? `Shift outer delivery point cluster from ${longest.route_id} (${longest.employee_name}) to ${shortRouteColleague.employee_name} (${shortRouteColleague.route_id}, ${shortRouteColleague.route_length_km} km).`
        : `Split high-mileage delivery segments on ${longest.route_id} across adjacent Kaduwela delivery beats.`,
      fromEmployeeId: longest.employee_id,
      toEmployeeId: shortRouteColleague?.employee_id || '',
      transferCount: 1,
    })
  }

  // 3. Employee availability and approved leave check
  if (onLeaveWithWork.length > 0) {
    const leaveEmp = onLeaveWithWork[0]
    recommendations.push({
      id: 'REC-LEAVE-GUARD',
      category: 'Leave & Availability',
      priority: 'High',
      title: 'Consider employee availability and approved leave before assigning tasks',
      affected: `${leaveEmp.employee_name} (${leaveEmp.employee_id}) · Approved Leave`,
      reason: `${leaveEmp.employee_name} has an approved leave record on file and currently has ${leaveEmp.assigned_tasks} assigned tasks (${leaveEmp.pending_tasks} pending).`,
      suggestedAction: `Reassign ${leaveEmp.pending_tasks || 1} pending task(s) from ${leaveEmp.employee_name} to an active ${leaveEmp.designation} on duty.`,
      fromEmployeeId: leaveEmp.employee_id,
      toEmployeeId: '',
      transferCount: Math.max(1, leaveEmp.pending_tasks),
    })
  } else {
    recommendations.push({
      id: 'REC-LEAVE-GUARD',
      category: 'Leave & Availability',
      priority: 'Normal',
      title: 'Consider employee availability and approved leave before assigning tasks',
      affected: 'All 16 Kaduwela Post Office Staff · Roster & Leave Registry',
      reason: 'Approved leave records and daily attendance check-ins must be verified before finalizing shift handovers.',
      suggestedAction: 'Keep automated leave checks active when creating or balancing daily allocations.',
      fromEmployeeId: '',
      toEmployeeId: '',
      transferCount: 0,
    })
  }

  // 4. Prioritize overdue and high-priority pending tasks
  if (highPending.length > 0) {
    const topPending = [...highPending].sort((a, b) => b.pending_tasks - a.pending_tasks)[0]
    recommendations.push({
      id: 'REC-PRIORITY-PENDING',
      category: 'Task Prioritization',
      priority: 'High',
      title: 'Prioritize uncompleted and high-priority tasks before end-of-day dispatch',
      affected: `${topPending.employee_name} (${topPending.employee_id}) · ${topPending.pending_tasks} pending tasks`,
      reason: `${topPending.employee_name} has ${topPending.pending_tasks} uncompleted task batches in ${topPending.primary_task_type}${topPending.route_id ? ` on route ${topPending.route_id}` : ''}.`,
      suggestedAction: `Prioritize clearance of ${topPending.pending_tasks} pending items or reassign 1 batch to an underutilized colleague.`,
      fromEmployeeId: topPending.employee_id,
      toEmployeeId: underutilized[0]?.employee_id || '',
      transferCount: 1,
    })
  }

  // 5. Prevent duplicate route/task assignments
  recommendations.push({
    id: 'REC-DUPLICATE-GUARD',
    category: 'Assignment Integrity',
    priority: 'Normal',
    title: 'Avoid assigning duplicate tasks or conflicting routes to the same officer',
    affected: 'Route & Counter Assignment Validation',
    reason: 'Duplicate route IDs or incompatible task-to-designation pairings reduce timeliness and cause overtime.',
    suggestedAction: 'Enforce role-fit and duplicate-route validation in the Create Allocation workflow.',
    fromEmployeeId: '',
    toEmployeeId: '',
    transferCount: 0,
  })

  return recommendations
}

/**
 * Validate the Create Allocation form inputs and check for duplicate/conflicting assignments.
 */
export function validateAllocationForm(form = {}, existingRows = []) {
  const errors = {}
  const dateStr = String(form.date || '').trim()
  const employeeId = String(form.employee_id || '').trim()
  const designation = String(form.designation || '').trim()
  const taskType = String(form.task_type || '').trim()
  const routeId = String(form.route_id || '').trim()
  const routeLengthKm = toNum(form.route_length_km, 0)
  const deliveryPoints = toNum(form.delivery_points, 0)
  const assignedTasks = toNum(form.assigned_tasks, NaN)
  const startTime = String(form.start_time || '').trim()
  const endTime = String(form.expected_completion_time || '').trim()

  if (!dateStr) errors.date = 'Allocation date is required.'
  if (!employeeId) errors.employee_id = 'Please select an employee.'
  if (!designation) errors.designation = 'Designation is required.'
  if (!taskType) errors.task_type = 'Task type is required.'

  if (!Number.isFinite(assignedTasks) || assignedTasks < 1 || assignedTasks > 40) {
    errors.assigned_tasks = 'Assigned tasks must be between 1 and 40.'
  }

  const fit = TASK_ROLE_FIT[taskType]
  if (fit && designation && !fit.roles.includes(designation)) {
    errors.task_type = `${designation} cannot be assigned "${taskType}". Allowed roles: ${fit.roles.join(', ')}.`
  }

  if (fit?.isDelivery) {
    if (!routeId) {
      errors.route_id = 'Route ID is required for field delivery tasks.'
    }
    if (routeLengthKm <= 0 || routeLengthKm > 120) {
      errors.route_length_km = 'Route length must be between 0.5 km and 120 km.'
    }
    if (deliveryPoints < 1 || deliveryPoints > 2000) {
      errors.delivery_points = 'Delivery points must be between 1 and 2,000.'
    }
  }

  if (startTime && endTime && startTime >= endTime) {
    errors.expected_completion_time = 'Expected completion time must be later than start time.'
  }

  const existingEmpRow = existingRows.find((r) => r.employee_id === employeeId)
  if (existingEmpRow?.on_leave) {
    errors.employee_id = `${existingEmpRow.employee_name} is on approved leave on ${dateStr}.`
  }

  // Duplicate route check across other employees on the same day
  if (routeId) {
    const conflictingRouteOwner = existingRows.find(
      (r) =>
        r.employee_id !== employeeId &&
        r.is_live_date_log &&
        String(r.route_id || '').trim().toUpperCase() === routeId.toUpperCase(),
    )
    if (conflictingRouteOwner) {
      errors.route_id = `Route ${routeId} is already assigned to ${conflictingRouteOwner.employee_name} (${conflictingRouteOwner.employee_id}) on ${dateStr}.`
    }
  }

  // Duplicate same task + same employee check when mode is 'create' and live log already has identical task & route
  if (form.checkDuplicateTask && existingEmpRow?.is_live_date_log) {
    if (
      existingEmpRow.primary_task_type === taskType &&
      (!routeId || existingEmpRow.route_id === routeId)
    ) {
      errors.duplicate_warning = `${existingEmpRow.employee_name} already has an active "${taskType}" allocation for ${dateStr}. Submitting will update/merge with their day's workload.`
    }
  }

  return {
    valid: Object.keys(errors).filter((k) => k !== 'duplicate_warning').length === 0,
    errors,
  }
}

/**
 * Compute an Auto-Balance Workload preview (before & after) without mutating database records.
 * Balances tasks from Overloaded / Near Capacity / On-Leave employees to Underutilized / Balanced
 * employees within compatible work categories and designations.
 */
export function computeAutoBalancePreview(rows = [], targetTasks = DEFAULT_DAILY_TARGET_TASKS) {
  const cloned = rows.map((r) => ({ ...r }))
  const transfers = []

  // Sort donors: on-leave with pending tasks first, then highest workload_pct
  const donors = cloned
    .filter(
      (r) =>
        (r.on_leave && r.assigned_tasks > r.completed_tasks) ||
        r.workload_status === 'Overloaded' ||
        (r.workload_status === 'Near Capacity' && r.assigned_tasks > targetTasks),
    )
    .sort((a, b) => {
      if (a.on_leave !== b.on_leave) return a.on_leave ? -1 : 1
      return b.workload_pct - a.workload_pct
    })

  for (const donor of donors) {
    const removable = Math.max(
      0,
      donor.on_leave
        ? donor.assigned_tasks - donor.completed_tasks
        : Math.min(
            donor.assigned_tasks - donor.completed_tasks,
            donor.assigned_tasks - targetTasks,
          ),
    )
    // Even if completed == assigned on historical rows, allow shifting 1 future planned task if overloaded (>110%)
    const transferable = removable > 0 ? removable : donor.workload_pct > 110 ? 1 : 0
    if (transferable <= 0) continue

    let remainingToMove = transferable
    while (remainingToMove > 0) {
      // Find best receiver in same work_category who is not on leave and has lowest workload_pct
      const candidates = cloned
        .filter(
          (r) =>
            r.employee_id !== donor.employee_id &&
            !r.on_leave &&
            r.work_category === donor.work_category &&
            r.workload_pct < 95,
        )
        .sort((a, b) => a.workload_pct - b.workload_pct)

      if (candidates.length === 0) break
      const receiver = candidates[0]

      donor.assigned_tasks = Math.max(0, donor.assigned_tasks - 1)
      if (donor.completed_tasks > donor.assigned_tasks) {
        donor.completed_tasks = donor.assigned_tasks
      }
      donor.pending_tasks = Math.max(0, donor.assigned_tasks - donor.completed_tasks)

      receiver.assigned_tasks += 1
      receiver.pending_tasks = Math.max(0, receiver.assigned_tasks - receiver.completed_tasks)

      // Recompute percentages
      for (const item of [donor, receiver]) {
        const routeBonus = item.route_length_km >= 22 ? 12 : item.route_length_km >= 16 ? 5 : 0
        const base = targetTasks > 0 ? Math.round((item.assigned_tasks / targetTasks) * 100) : 0
        item.workload_pct = item.assigned_tasks === 0 ? 0 : Math.min(160, base + routeBonus)
        const cls = classifyWorkloadStatus(item.workload_pct)
        item.workload_status = cls.status
        item.status_badge_class = cls.badgeClass
        item.bar_color = cls.barColor
      }

      const existingTransfer = transfers.find(
        (t) => t.from_employee_id === donor.employee_id && t.to_employee_id === receiver.employee_id,
      )
      if (existingTransfer) {
        existingTransfer.tasks_moved += 1
        existingTransfer.after_from_pct = donor.workload_pct
        existingTransfer.after_to_pct = receiver.workload_pct
        existingTransfer.after_from_tasks = donor.assigned_tasks
        existingTransfer.after_to_tasks = receiver.assigned_tasks
      } else {
        const origDonor = rows.find((r) => r.employee_id === donor.employee_id)
        const origReceiver = rows.find((r) => r.employee_id === receiver.employee_id)
        transfers.push({
          from_employee_id: donor.employee_id,
          from_employee_name: donor.employee_name,
          from_designation: donor.designation,
          to_employee_id: receiver.employee_id,
          to_employee_name: receiver.employee_name,
          to_designation: receiver.designation,
          work_category: donor.work_category,
          task_type: donor.primary_task_type,
          route_id: donor.route_id,
          tasks_moved: 1,
          before_from_tasks: origDonor?.assigned_tasks ?? donor.assigned_tasks + 1,
          after_from_tasks: donor.assigned_tasks,
          before_from_pct: origDonor?.workload_pct ?? donor.workload_pct,
          after_from_pct: donor.workload_pct,
          before_to_tasks: origReceiver?.assigned_tasks ?? receiver.assigned_tasks - 1,
          after_to_tasks: receiver.assigned_tasks,
          before_to_pct: origReceiver?.workload_pct ?? receiver.workload_pct,
          after_to_pct: receiver.workload_pct,
          reason: donor.on_leave
            ? `Reassigned from ${donor.employee_name} (on approved leave) to available ${receiver.designation}`
            : `Balanced high load (${origDonor?.workload_pct}% → ${donor.workload_pct}%) to available capacity (${origReceiver?.workload_pct}% → ${receiver.workload_pct}%)`,
        })
      }

      remainingToMove -= 1
    }
  }

  const beforeSummary = calculateWorkloadSummaryCards(rows)
  const afterSummary = calculateWorkloadSummaryCards(cloned)

  return {
    transfers,
    beforeSummary,
    afterSummary,
    afterRows: cloned,
  }
}
