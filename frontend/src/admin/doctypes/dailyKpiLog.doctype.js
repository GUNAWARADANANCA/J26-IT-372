/** Frappe-style DocType meta for Daily KPI Log */

export const dailyKpiLogDoctype = {
  name: 'Daily KPI Log',
  doctype: 'daily_kpi_log',
  naming: 'composite', // employee_id-date
  title_field: 'primary_task_type',
  list_fields: [
    'employee_id',
    'date',
    'primary_task_type',
    'completion_rate',
    'kpi_score',
    'performance_category',
  ],
  search_fields: ['employee_id', 'date', 'primary_task_type', 'performance_category'],
  filters: [
    {
      fieldname: 'performance_category',
      label: 'Performance Category',
      options: [
        'Outstanding',
        'High Performing',
        'Satisfactory',
        'Needs Improvement',
        'Underperforming',
      ],
    },
  ],
  sections: [
    {
      label: 'Daily Work',
      fields: [
        {
          fieldname: 'employee_id',
          label: 'Employee',
          fieldtype: 'Link',
          options: 'employee',
          reqd: true,
        },
        {
          fieldname: 'date',
          label: 'Date',
          fieldtype: 'Date',
          reqd: true,
        },
        {
          fieldname: 'day_of_week',
          label: 'Day of Week',
          fieldtype: 'Data',
          read_only: true,
        },
        {
          fieldname: 'primary_task_type',
          label: 'Primary Task Type',
          fieldtype: 'Select',
          reqd: true,
          options: [
            'Accounts Processing',
            'Accounts Verification',
            'Ad-hoc Project Support',
            'Approvals & Audit',
            'Calendar Management',
            'Communication Support',
            'Correspondence Handling',
            'Customer Service Counter',
            'Data Entry',
            'Mail & Parcel Delivery',
            'Money Order Processing',
            'Postal Clerk Duties',
            'Staff Performance Review',
            'Stock & Inventory Check',
            'Team Coordination',
            'Work Allocation & Supervision',
            'Workflow Coordination',
          ],
        },
        {
          fieldname: 'route_id',
          label: 'Route ID',
          fieldtype: 'Data',
          depends_on: 'delivery',
        },
        {
          fieldname: 'route_length_km',
          label: 'Route Length (km)',
          fieldtype: 'Float',
          depends_on: 'delivery',
        },
        {
          fieldname: 'distance_covered_km',
          label: 'Distance Covered (km)',
          fieldtype: 'Float',
          depends_on: 'delivery',
        },
      ],
    },
    {
      label: 'Work Counts',
      fields: [
        {
          fieldname: 'assigned_work_count',
          label: 'Assigned Work Count',
          fieldtype: 'Int',
          reqd: true,
        },
        {
          fieldname: 'completed_work_count',
          label: 'Completed Work Count',
          fieldtype: 'Int',
          reqd: true,
        },
        {
          fieldname: 'uncompleted_work_count',
          label: 'Uncompleted Work Count',
          fieldtype: 'Int',
          read_only: true,
        },
        {
          fieldname: 'correct_work_count',
          label: 'Correct Work Count',
          fieldtype: 'Int',
        },
        {
          fieldname: 'incorrect_work_count',
          label: 'Incorrect Work Count',
          fieldtype: 'Int',
        },
        {
          fieldname: 'on_time_work_count',
          label: 'On Time Work Count',
          fieldtype: 'Int',
        },
        {
          fieldname: 'late_work_count',
          label: 'Late Work Count',
          fieldtype: 'Int',
        },
      ],
    },
    {
      label: 'Office / Supervisory',
      fields: [
        {
          fieldname: 'approvals_processed',
          label: 'Approvals Processed',
          fieldtype: 'Int',
          depends_on: 'supervisory',
        },
        {
          fieldname: 'accounts_verified',
          label: 'Accounts Verified',
          fieldtype: 'Int',
          depends_on: 'supervisory',
        },
        {
          fieldname: 'revenue_collected_lkr',
          label: 'Revenue Collected (LKR)',
          fieldtype: 'Float',
        },
      ],
    },
    {
      label: 'KPI Metrics',
      fields: [
        {
          fieldname: 'completion_rate',
          label: 'Completion Rate %',
          fieldtype: 'Float',
          read_only: true,
        },
        {
          fieldname: 'accuracy_rate',
          label: 'Accuracy Rate %',
          fieldtype: 'Float',
          read_only: true,
        },
        {
          fieldname: 'timeliness_rate',
          label: 'Timeliness Rate %',
          fieldtype: 'Float',
          read_only: true,
        },
        {
          fieldname: 'kpi_score',
          label: 'KPI Score',
          fieldtype: 'Float',
          read_only: true,
        },
        {
          fieldname: 'performance_category',
          label: 'Performance Category',
          fieldtype: 'Data',
          read_only: true,
        },
      ],
    },
  ],
}

export default dailyKpiLogDoctype
