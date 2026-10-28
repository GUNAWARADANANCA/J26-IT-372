import { useState } from 'react'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import { useFieldOptions } from '../data/fieldOptions'

export default function CreatableSelect({ field, value, onChange, disabled }) {
  const { extra, addOption, mergeOptions } = useFieldOptions()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const phrase = field.label.toLowerCase()
  const options = mergeOptions(field.options, extra[field.fieldname], value)

  function openModal() {
    setDraft('')
    setError('')
    setOpen(true)
  }

  async function handleCreate() {
    const next = draft.trim()
    if (!next) {
      setError(`Enter a ${phrase}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const saved = await addOption(field.fieldname, next)
      onChange(saved)
      setOpen(false)
    } catch (err) {
      setError(err.message || 'Could not create this value')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <TextField
        select
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value === '__create__') return
          onChange(event.target.value)
        }}
      >
        {field.creatable && (
          <MenuItem
            value="__create__"
            onMouseDown={(event) => {
              event.preventDefault()
              openModal()
            }}
          >
            - Add New {phrase}
          </MenuItem>
        )}
        {/* <MenuItem value="">—</MenuItem> */}
        {options.map((opt) => (
          <MenuItem key={opt} value={opt}>
            {opt}
          </MenuItem>
        ))}
      </TextField>
      <Dialog
        open={open}
        onClose={() => {
          if (!saving) setOpen(false)
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>- Add New {phrase}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            label={field.label}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleCreate()
              }
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
