/** Frappe-style DocType meta for Employee */

export const employeeDoctype = {
  name: 'Employee',
  doctype: 'employee',
  naming: 'employee_id',
  title_field: 'employee_name',
  list_fields: [
    'employee_id',
    'employee_name',
    'post_office',
    'designation',
    'work_category',
    'employment_type',
  ],
  search_fields: ['employee_id', 'employee_name', 'post_office', 'designation'],
  filters: [
    {
      fieldname: 'post_office',
      label: 'Post Office',
      options: [
        'Anuradhapura',
        'Colombo Central',
        'Galle',
        'Jaffna',
        'Kandy',
        'Kurunegala',
        'Matara',
        'Negombo',
      ],
    },
    {
      fieldname: 'work_category',
      label: 'Work Category',
      options: ['Delivery (Field)', 'Office', 'Supervisory / Office'],
    },
  ],
  sections: [
    {
      label: 'Employee Details',
      fields: [
        {
          fieldname: 'employee_id',
          label: 'Employee ID',
          fieldtype: 'Data',
          reqd: true,
          in_list: true,
        },
        {
          fieldname: 'employee_name',
          label: 'Employee Name',
          fieldtype: 'Data',
          reqd: true,
        },
        {
          fieldname: 'post_office',
          label: 'Post Office',
          fieldtype: 'Select',
          reqd: true,
          options: [
            'Anuradhapura',
            'Colombo Central',
            'Galle',
            'Jaffna',
            'Kandy',
            'Kurunegala',
            'Matara',
            'Negombo',
          ],
        },
        {
          fieldname: 'designation',
          label: 'Designation',
          fieldtype: 'Select',
          reqd: true,
          options: [
            'Delivery Officer',
            'Postal Assistant',
            'Postal Clerk',
            'Postman',
            'Postmaster (Head)',
            'Senior Postman',
          ],
        },
        {
          fieldname: 'work_category',
          label: 'Work Category',
          fieldtype: 'Select',
          reqd: true,
          options: ['Delivery (Field)', 'Office', 'Supervisory / Office'],
        },
        {
          fieldname: 'years_of_experience',
          label: 'Years of Experience',
          fieldtype: 'Int',
        },
        {
          fieldname: 'employment_type',
          label: 'Employment Type',
          fieldtype: 'Select',
          options: ['Permanent', 'Contract', 'Temporary'],
        },
        {
          fieldname: 'reports_to',
          label: 'Reports To',
          fieldtype: 'Data',
          description: 'Employee ID or Regional HQ',
        },
      ],
    },
    {
      label: 'Promotion & Rewards',
      fields: [
        {
          fieldname: 'prior_6month_avg_kpi_score',
          label: 'Prior 6-Month Avg KPI Score',
          fieldtype: 'Float',
        },
        {
          fieldname: 'promotion_eligible',
          label: 'Promotion Eligible',
          fieldtype: 'Select',
          options: ['Yes', 'No'],
        },
        {
          fieldname: 'last_promotion_date',
          label: 'Last Promotion Date',
          fieldtype: 'Date',
        },
        {
          fieldname: 'months_since_last_promotion',
          label: 'Months Since Last Promotion',
          fieldtype: 'Float',
          read_only: true,
        },
        {
          fieldname: 'reward_received',
          label: 'Reward Received',
          fieldtype: 'Select',
          options: ['Yes', 'No'],
        },
        {
          fieldname: 'reward_type',
          label: 'Reward Type',
          fieldtype: 'Select',
          options: [
            'None',
            'Certificate of Appreciation',
            'Employee of the Month',
            'Long Service Award',
            'Performance Bonus',
          ],
        },
      ],
    },
  ],
}

export default employeeDoctype
