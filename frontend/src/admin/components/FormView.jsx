import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import FormSection from './FormSection'
import LinkField from './LinkField'
import { get as getDoc, list } from '../data/repository'

function emptyFromMeta(meta) {
  const doc = {}
  for (const section of meta.sections) {
    for (const f of section.fields) {
      doc[f.fieldname] = ''
    }
  }
  return doc
}

function shouldShowField(field, doc, employeeDoc) {
  if (!field.depends_on) return true
  const category = employeeDoc?.work_category || ''
  if (field.depends_on === 'delivery') {
    return (
      category.includes('Delivery') ||
      doc.primary_task_type === 'Mail & Parcel Delivery'
    )
  }
  if (field.depends_on === 'supervisory') {
    return (
      category.includes('Supervisory') ||
      [
        'Approvals & Audit',
        'Accounts Verification',
        'Work Allocation & Supervision',
      ].includes(doc.primary_task_type)
    )
  }
  return true
}

export default function FormView({
  meta,
  name,
  isNew,
  basePath,
  onSave,
  onDelete,
  prepareDoc,
  initialOverrides = {},
}) {
  const navigate = useNavigate()
  const [doc, setDoc] = useState(() => ({
    ...emptyFromMeta(meta),
    ...initialOverrides,
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(isNew)

  useEffect(() => {
    if (isNew) {
      setDoc({ ...emptyFromMeta(meta), ...initialOverrides })
      setLoaded(true)
      return
    }
    const existing = getDoc(meta.doctype, name)
    if (!existing) {
      setError('Document not found')
      setLoaded(true)
      return
    }
    setDoc(existing)
    setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.doctype, name, isNew])

  const employeeDoc = useMemo(() => {
    if (!doc.employee_id) return null
    return list('employee').find((e) => e.name === doc.employee_id) ?? null
  }, [doc.employee_id])

  function applyFetchFrom(nextDoc, changedField, changedValue) {
    const patches = {}
    for (const section of meta.sections) {
      for (const f of section.fields) {
        if (!f.fetch_from) continue
        const [sourceField, sourceProp] = f.fetch_from.split('.')
        if (sourceField !== changedField) continue
        if (!changedValue) {
          patches[f.fieldname] = ''
          continue
        }
        const linked = list(
          meta.sections
            .flatMap((s) => s.fields)
            .find((x) => x.fieldname === sourceField)?.options || 'employee',
        ).find((r) => r.name === changedValue)
        patches[f.fieldname] = linked?.[sourceProp] ?? ''
      }
    }
    return { ...nextDoc, ...patches }
  }

  function setField(fieldname, value) {
    setDoc((prev) => {
      const next = { ...prev, [fieldname]: value }
      return applyFetchFrom(next, fieldname, value)
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      for (const section of meta.sections) {
        for (const f of section.fields) {
          if (
            f.reqd &&
            (doc[f.fieldname] === '' || doc[f.fieldname] == null)
          ) {
            throw new Error(`${f.label} is required`)
          }
        }
      }
      const prepared = prepareDoc ? prepareDoc(doc, { isNew }) : doc
      await onSave(prepared, { isNew })
      navigate(`${basePath}/${encodeURIComponent(prepared.name)}`, {
        replace: true,
      })
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${name}?`)) return
    try {
      await onDelete(name)
      navigate(basePath)
    } catch (err) {
      setError(err.message || 'Delete failed')
    }
  }

  if (!loaded) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  return (
    <Box
      component="form"
      onSubmit={handleSave}
      sx={{ maxWidth: 960 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Breadcrumbs sx={{ mb: 0.5 }}>
            <Link
              component="button"
              type="button"
              underline="hover"
              color="inherit"
              onClick={() => navigate(basePath)}
              sx={{ fontSize: 12 }}
            >
              {meta.name}
            </Link>
            <Typography color="text.primary" sx={{ fontSize: 12 }}>
              {isNew ? 'New' : doc.name}
            </Typography>
          </Breadcrumbs>
          <Typography variant="h5">
            {isNew ? `New ${meta.name}` : doc[meta.title_field] || doc.name}
          </Typography>
          {!isNew && (
            <Typography variant="body2" color="text.secondary">
              {doc.name}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          {!isNew && (
            <Button variant="outlined" color="error" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {meta.sections.map((section) => (
        <FormSection key={section.label} label={section.label}>
          {section.fields.map((field) => {
            if (!shouldShowField(field, doc, employeeDoc)) return null
            return (
              <Box
                key={field.fieldname}
                sx={{
                  width: { xs: '100%', sm: '50%' },
                  px: 1,
                  boxSizing: 'border-box',
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ mb: 0.5 }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={550}>
                    {field.label}
                    {field.reqd ? ' *' : ''}
                  </Typography>
                  {field.read_only && (
                    <Chip label="read only" size="small" variant="outlined" />
                  )}
                </Stack>
                <FieldInput
                  field={field}
                  value={doc[field.fieldname]}
                  onChange={(v) => setField(field.fieldname, v)}
                  disabled={field.read_only}
                />
                {field.description && (
                  <Typography variant="caption" color="text.secondary">
                    {field.description}
                  </Typography>
                )}
              </Box>
            )
          })}
        </FormSection>
      ))}
    </Box>
  )
}

function FieldInput({ field, value, onChange, disabled }) {
  if (field.fieldtype === 'Link') {
    return (
      <LinkField
        doctype={field.options}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  if (field.fieldtype === 'Select') {
    return (
      <TextField
        select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="">—</MenuItem>
        {field.options.map((opt) => (
          <MenuItem key={opt} value={opt}>
            {opt}
          </MenuItem>
        ))}
      </TextField>
    )
  }

  if (field.fieldtype === 'Int' || field.fieldtype === 'Float') {
    return (
      <TextField
        type="number"
        value={value ?? ''}
        disabled={disabled}
        inputProps={{ step: field.fieldtype === 'Float' ? 'any' : '1' }}
        onChange={(e) =>
          onChange(e.target.value === '' ? '' : Number(e.target.value))
        }
      />
    )
  }

  if (field.fieldtype === 'Date') {
    return (
      <TextField
        type="date"
        value={value ?? ''}
        disabled={disabled}
        InputLabelProps={{ shrink: true }}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  if (field.fieldtype === 'Time') {
    return (
      <TextField
        type="time"
        value={value ?? ''}
        disabled={disabled}
        InputLabelProps={{ shrink: true }}
        inputProps={{ step: 60 }}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  return (
    <TextField
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
