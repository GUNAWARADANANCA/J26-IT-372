/** Module meta for Attendance Logs (fingerprint in / out) */

export const attendanceLogDoctype = {
  name: 'Attendance Log',
  doctype: 'attendance_log',
  naming: 'composite',
  title_field: 'employee_name',
  list_fields: [
    'employee_id',
    'employee_name',
    'post_office',
    'designation',
    'date',
    'fingerprint_in',
    'fingerprint_out',
  ],
  search_fields: [
    'employee_id',
    'employee_name',
    'post_office',
    'designation',
    'date',
  ],
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
  ],
  sections: [
    {
      label: 'Employee',
      fields: [
        {
          fieldname: 'employee_id',
          label: 'Employee ID',
          fieldtype: 'Link',
          options: 'employee',
          reqd: true,
        },
        {
          fieldname: 'employee_name',
          label: 'Employee Name',
          fieldtype: 'Data',
          read_only: true,
          fetch_from: 'employee_id.employee_name',
        },
        {
          fieldname: 'post_office',
          label: 'Post Office',
          fieldtype: 'Data',
          read_only: true,
          fetch_from: 'employee_id.post_office',
        },
        {
          fieldname: 'designation',
          label: 'Designation',
          fieldtype: 'Data',
          read_only: true,
          fetch_from: 'employee_id.designation',
        },
      ],
    },
    {
      label: 'Fingerprint In / Out',
      fields: [
        {
          fieldname: 'date',
          label: 'Date',
          fieldtype: 'Date',
          reqd: true,
        },
        {
          fieldname: 'fingerprint_in',
          label: 'Fingerprint In',
          fieldtype: 'Time',
          reqd: true,
        },
        {
          fieldname: 'fingerprint_out',
          label: 'Fingerprint Out',
          fieldtype: 'Time',
        },
      ],
    },
  ],
}

export default attendanceLogDoctype
