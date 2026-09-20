import { useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import { list } from '../data/repository'

/**
 * Frappe-style Link field — search/select a document from another DocType.
 */
export default function LinkField({
  doctype,
  value,
  onChange,
  labelField = 'employee_name',
  idField = 'name',
  disabled = false,
  placeholder = 'Type to search…',
}) {
  const [inputValue, setInputValue] = useState('')

  const options = useMemo(() => list(doctype), [doctype])

  const selected =
    options.find((r) => r[idField] === value) ?? null

  return (
    <Autocomplete
      size="small"
      disabled={disabled}
      options={options}
      value={selected}
      inputValue={inputValue}
      onInputChange={(_, v) => setInputValue(v)}
      onChange={(_, option) => onChange(option ? option[idField] : '')}
      getOptionLabel={(option) =>
        option
          ? `${option[idField]}${option[labelField] ? ` — ${option[labelField]}` : ''}`
          : ''
      }
      isOptionEqualToValue={(a, b) => a?.[idField] === b?.[idField]}
      filterOptions={(opts, state) => {
        const q = state.inputValue.trim().toLowerCase()
        if (!q) return opts.slice(0, 40)
        return opts
          .filter((row) =>
            Object.values(row).some((v) =>
              String(v ?? '')
                .toLowerCase()
                .includes(q),
            ),
          )
          .slice(0, 40)
      }}
      renderInput={(params) => (
        <TextField {...params} placeholder={placeholder} />
      )}
    />
  )
}
