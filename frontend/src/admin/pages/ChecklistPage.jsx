import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

const DEFAULT_ITEMS = [
  ['operations', 'Incoming Mail Registration'],
  ['operations', 'Parcel Registration and Sorting'],
  ['operations', 'Registered Mail Delivery'],
  ['operations', 'Parcel Delivery by Route'],
  ['operations', 'Ordinary Letter Delivery'],
  ['operations', 'Article Scanning and Tracking Updates'],
  ['operations', 'Pending Mail and Parcel Clearance'],
  ['operations', 'Undelivered Article Processing'],
  ['operations', 'Counter Customer Service'],
  ['operations', 'Postage and Fee Verification'],
  ['control', 'Postal Financial Transactions'],
  ['control', 'Proof of Delivery Verification'],
  ['control', 'Late Delivery Follow-up'],
  ['control', 'Attendance and Staff Availability Review'],
  ['control', 'Daily Work Allocation Review'],
  ['control', 'Incomplete Task Follow-up'],
  ['control', 'Incorrect Record and Address Verification'],
  ['control', 'Returned Mail and Parcel Processing'],
  ['control', 'Daily Productivity and Workload Review'],
  ['control', 'End-of-Day Reconciliation and Reporting'],
].map(([side, label], index) => ({ id: index + 1, side, label }))

const LIST_KEY = 'postassist-checklist-items'

function dayKey() {
  return `postassist-checklist-${new Date().toISOString().slice(0, 10)}`
}

function loadItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIST_KEY) || 'null')
    if (Array.isArray(saved) && saved.length > 0) return saved
  } catch {
    /* use the default list */
  }
  return DEFAULT_ITEMS
}

export function checklistLabels(date) {
  const items = loadItems()
  const saved = localStorage.getItem(`postassist-checklist-${date}`)
  if (!saved) return items.map((item) => ({ label: item.label, checked: true }))
  try {
    const ids = JSON.parse(saved)
    if (!Array.isArray(ids) || ids.length === 0) {
      return items.map((item) => ({ label: item.label, checked: true }))
    }
    const checked = new Set(ids)
    return items
      .filter((item) => checked.has(item.id))
      .map((item) => ({ label: item.label, checked: true }))
  } catch {
    return items.map((item) => ({ label: item.label, checked: true }))
  }
}

function loadChecked(items) {
  const saved = localStorage.getItem(dayKey())
  if (!saved) return new Set(items.map((item) => item.id))
  try {
    const ids = JSON.parse(saved)
    if (!Array.isArray(ids) || ids.length === 0) return new Set(items.map((item) => item.id))
    return new Set(ids)
  } catch {
    return new Set(items.map((item) => item.id))
  }
}

function Circle({ checked }) {
  return (
    <Box
      sx={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: '2px solid',
        borderColor: checked ? '#2490ef' : '#8d99a6',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {checked ? <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#2490ef' }} /> : null}
    </Box>
  )
}

export default function ChecklistPage() {
  const [items, setItems] = useState(loadItems)
  const [checked, setChecked] = useState(() => loadChecked(loadItems()))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(items)
  const [addOpen, setAddOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newSide, setNewSide] = useState('operations')

  useEffect(() => {
    localStorage.setItem(dayKey(), JSON.stringify([...checked]))
  }, [checked])

  function toggle(id) {
    if (editing) return
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startEdit() {
    setDraft(items.map((item) => ({ ...item })))
    setEditing(true)
  }

  function updateLabel(id, label) {
    setDraft((current) => current.map((item) => (item.id === id ? { ...item, label } : item)))
  }

  function removeItem(id) {
    setDraft((current) => current.filter((item) => item.id !== id))
  }

  function addTask() {
    const label = newLabel.trim()
    if (!label) return
    const source = editing ? draft : items
    const id = source.reduce((max, item) => Math.max(max, item.id), 0) + 1
    const task = { id, side: newSide, label }
    const next = [...source, task]
    if (editing) {
      setDraft(next)
    } else {
      setItems(next)
      localStorage.setItem(LIST_KEY, JSON.stringify(next))
    }
    setChecked((current) => new Set([...current, id]))
    setNewLabel('')
    setNewSide('operations')
    setAddOpen(false)
  }

  function saveUpdate() {
    const next = draft
      .map((item) => ({ ...item, label: item.label.trim() }))
      .filter((item) => item.label)
    setItems(next)
    setChecked((current) => new Set([...current].filter((id) => next.some((item) => item.id === id))))
    localStorage.setItem(LIST_KEY, JSON.stringify(next))
    setEditing(false)
  }

  const shown = editing ? draft : items
  const sides = [
    ['Side 1 — Operations', shown.filter((item) => item.side === 'operations')],
    ['Side 2 — Control', shown.filter((item) => item.side === 'control')],
  ]
  const checkedCount = shown.filter((item) => checked.has(item.id)).length

  return (
    <Box sx={{ bgcolor: '#ffffff', border: '1px solid #e3e8ee', borderRadius: 2, p: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Daily task verification
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="contained" size="small" onClick={() => setAddOpen(true)}>
            Add checklist
          </Button>
          <Box sx={{ border: '1px solid #d5dde5', borderRadius: 999, px: 1.25, py: 0.4, fontSize: 13 }}>
            {checkedCount}/{shown.length} checked
          </Box>
        </Stack>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        {sides.map(([title, rows]) => (
          <Box key={title} sx={{ flex: 1, border: '1px solid #e3e8ee', borderRadius: 2, overflow: 'hidden' }}>
            <Typography sx={{ px: 1.5, py: 1.25, fontWeight: 700 }}>{title}</Typography>
            {rows.map((item) => (
              <Stack
                key={item.id}
                direction="row"
                spacing={1.5}
                alignItems="center"
                onClick={() => toggle(item.id)}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderTop: '1px solid #eef2f6',
                  cursor: editing ? 'default' : 'pointer',
                }}
              >
                <Circle checked={checked.has(item.id)} />
                {editing ? (
                  <TextField
                    value={item.label}
                    onChange={(event) => updateLabel(item.id, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    size="small"
                    fullWidth
                  />
                ) : (
                  <Typography sx={{ flex: 1, fontSize: 15 }}>
                    {item.id}. {item.label}
                  </Typography>
                )}
                {editing ? (
                  <Button
                    color="error"
                    onClick={(event) => {
                      event.stopPropagation()
                      removeItem(item.id)
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </Stack>
            ))}
          </Box>
        ))}
      </Stack>
      <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 1.5 }}>
        {editing ? (
          <Button variant="contained" onClick={saveUpdate}>
            Update
          </Button>
        ) : (
          <Button variant="outlined" onClick={startEdit}>
            Edit
          </Button>
        )}
      </Stack>
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add checklist</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField
              label="Task"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              size="small"
              autoFocus
            />
            <TextField
              select
              label="Side"
              value={newSide}
              onChange={(event) => setNewSide(event.target.value)}
              size="small"
            >
              <MenuItem value="operations">Side 1 — Operations</MenuItem>
              <MenuItem value="control">Side 2 — Control</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addTask} disabled={!newLabel.trim()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
