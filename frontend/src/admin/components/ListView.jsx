import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import InputAdornment from '@mui/material/InputAdornment'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import { list } from '../data/repository'

const PAGE_SIZE = 50

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function labelize(col) {
  return col.replaceAll('_', ' ')
}

export default function ListView({ meta, basePath, title, refreshKey = 0 }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(0)

  const rows = useMemo(() => {
    void refreshKey
    return list(meta.doctype, { search, filters })
  }, [meta.doctype, search, filters, refreshKey])

  useEffect(() => {
    setPage(0)
  }, [search, filters, refreshKey])

  const columns = meta.list_fields
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            Module
          </Typography>
          <Typography variant="h5">{title || meta.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {rows.length.toLocaleString()} records
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate(`${basePath}/new`)}
        >
          Add {meta.name}
        </Button>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mb: 1.5 }}
      >
        <TextField
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
        {(meta.filters || []).map((f) => (
          <TextField
            key={f.fieldname}
            select
            label={f.label}
            value={filters[f.fieldname] || ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                [f.fieldname]: e.target.value,
              }))
            }
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {f.options.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
        ))}
      </Stack>

      <Paper>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 260px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col}>{labelize(col)}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No records found</Typography>
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((row) => (
                <TableRow
                  key={row.name}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() =>
                    navigate(`${basePath}/${encodeURIComponent(row.name)}`)
                  }
                >
                  {columns.map((col) => (
                    <TableCell key={col}>{formatCell(row[col])}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
        />
      </Paper>
    </Box>
  )
}
