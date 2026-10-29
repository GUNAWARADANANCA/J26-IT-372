import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Filter,
  HelpCircle,
  Info,
  Layers,
  LineChart as LineChartIcon,
  Minus,
  Percent,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import PageHeader from '../ui/PageHeader'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import { getKpiDashboard, getKpiDashboardExportUrl } from '../data/repository'
import { useAuth } from '../data/auth'

function formatNum(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '—'
  return Number(val).toLocaleString('en-US', { maximumFractionDigits: 1 })
}

function formatPercent(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '—'
  return `${Number(val).toFixed(1)}%`
}

export default function KpiDashboardPage() {
  const { user } = useAuth()

  // Filters state
  const [periodType, setPeriodType] = useState('all')
  const [startDate, setStartDate] = useState('2025-09-01')
  const [endDate, setEndDate] = useState('2025-12-22')
  const [postOffice, setPostOffice] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [designation, setDesignation] = useState('')
  const [category, setCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // UI state
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [dashboardData, setDashboardData] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Table sorting & pagination
  const [order, setOrder] = useState('desc')
  const [orderBy, setOrderBy] = useState('kpi_score')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Export menu
  const [exportAnchorEl, setExportAnchorEl] = useState(null)

  // Load data
  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const res = await getKpiDashboard({
        periodType,
        startDate: startDate || '',
        endDate: endDate || '',
        postOffice,
        employeeId,
        designation,
        category,
        status: statusFilter,
      })
      setDashboardData(res)
    } catch (err) {
      setError(err.message || 'Failed to retrieve KPI dashboard telemetry.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [periodType, startDate, endDate, postOffice, employeeId, designation, category, statusFilter])

  const summary = dashboardData?.summary || {}
  const formula = dashboardData?.formula || {}
  const distribution = dashboardData?.distribution || {}
  const rawRows = dashboardData?.employee_rows || []
  const historicalTrends = dashboardData?.historical_trends || []
  const workload = dashboardData?.workload || {}
  const alerts = dashboardData?.alerts || []
  const filterOptions = dashboardData?.filter_options || { post_offices: [], designations: [], work_categories: [], employees: [] }
  const modelTelemetry = dashboardData?.model_telemetry || {}

  // Filter & sort table rows
  const filteredRows = useMemo(() => {
    let list = [...rawRows]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (r) =>
          r.employee_name?.toLowerCase().includes(q) ||
          r.employee_id?.toLowerCase().includes(q) ||
          r.designation?.toLowerCase().includes(q) ||
          r.post_office?.toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => {
      let aVal = a[orderBy]
      let bVal = b[orderBy]
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      if (typeof aVal === 'string') {
        return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return order === 'asc' ? aVal - bVal : bVal - aVal
    })
    return list
  }, [rawRows, searchQuery, order, orderBy])

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleRowClick = (emp) => {
    setSelectedEmployee(emp)
    setDrawerOpen(true)
  }

  const handlePrint = () => {
    window.print()
  }

  const getStatusChip = (status) => {
    switch (status) {
      case 'On Track':
        return <Chip label="On Track (≥80%)" size="small" sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 600, border: '1px solid #C8E6C9' }} />
      case 'Needs Improvement':
        return <Chip label="Needs Improvement (70-79%)" size="small" sx={{ bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 600, border: '1px solid #FFE0B2' }} />
      case 'Poor':
        return <Chip label="Poor (<70%)" size="small" sx={{ bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 600, border: '1px solid #FFCDD2' }} />
      default:
        return <Chip label="Not Evaluated" size="small" sx={{ bgcolor: '#F1F5F9', color: '#64748B', fontWeight: 600, border: '1px solid #E2E8F0' }} />
    }
  }

  const renderDelta = (delta) => {
    if (delta === null || delta === undefined) return <span style={{ color: '#94A3B8' }}>—</span>
    if (delta > 0) {
      return (
        <span style={{ color: '#2E7D32', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <ArrowUpRight size={14} /> +{delta.toFixed(1)}%
        </span>
      )
    }
    if (delta < 0) {
      return (
        <span style={{ color: '#C62828', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <ArrowDownRight size={14} /> {delta.toFixed(1)}%
        </span>
      )
    }
    return (
      <span style={{ color: '#64748B', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <Minus size={14} /> 0.0%
      </span>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 6 }} className="kpi-dashboard-container">
      {/* 1. Header Toolbar */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <PageHeader
          badge="DEPARTMENT OF POSTS SRI LANKA · NATIONAL KPI REPOSITORY"
          title="Comprehensive KPI Dashboard"
          subtitle="Executive overview of postal workforce productivity, accuracy, timeliness, attendance, workload capacity, and ML forecasting."
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }} className="no-print">
          <Button
            variant="outlined"
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshCw size={16} />}
            onClick={() => loadData(true)}
            disabled={refreshing}
            sx={{ borderColor: '#CBD5E1', color: '#0B1F3A', bgcolor: '#FFFFFF', '&:hover': { bgcolor: '#F8FAFC' } }}
          >
            Refresh
          </Button>

          <Button
            variant="outlined"
            startIcon={<Printer size={16} />}
            onClick={handlePrint}
            sx={{ borderColor: '#CBD5E1', color: '#0B1F3A', bgcolor: '#FFFFFF', '&:hover': { bgcolor: '#F8FAFC' } }}
          >
            Print Report
          </Button>

          <Button
            variant="contained"
            startIcon={<Download size={16} />}
            onClick={(e) => setExportAnchorEl(e.currentTarget)}
            sx={{ bgcolor: '#1677D2', color: '#FFFFFF', '&:hover': { bgcolor: '#0B1F3A' } }}
          >
            Export CSV
          </Button>
          <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={() => setExportAnchorEl(null)}>
            <MenuItem
              component="a"
              href={getKpiDashboardExportUrl({ exportType: 'employees', periodType, startDate, endDate, postOffice, designation, category, status: statusFilter })}
              target="_blank"
              onClick={() => setExportAnchorEl(null)}
            >
              <FileSpreadsheet size={16} style={{ marginRight: 8, color: '#1677D2' }} />
              Export Employee Performance Table (CSV)
            </MenuItem>
            <MenuItem
              component="a"
              href={getKpiDashboardExportUrl({ exportType: 'summary', periodType, startDate, endDate, postOffice, designation, category, status: statusFilter })}
              target="_blank"
              onClick={() => setExportAnchorEl(null)}
            >
              <BarChart3 size={16} style={{ marginRight: 8, color: '#0B1F3A' }} />
              Export Executive Summary Metrics (CSV)
            </MenuItem>
            <MenuItem
              component="a"
              href={getKpiDashboardExportUrl({ exportType: 'trends', periodType, startDate, endDate, postOffice, designation, category, status: statusFilter })}
              target="_blank"
              onClick={() => setExportAnchorEl(null)}
            >
              <LineChartIcon size={16} style={{ marginRight: 8, color: '#2E7D32' }} />
              Export Historical Weekly Trends (CSV)
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* 2. Filter Bar */}
      <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 2 }} className="no-print">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Filter size={18} color="#1677D2" />
          <Typography variant="subtitle2" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
            REPORTING FILTERS & SCOPE
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B', ml: 'auto' }}>
            Available Data: {summary.reporting_period?.available_range?.earliest || '2025-09-01'} to {summary.reporting_period?.available_range?.latest || '2025-12-19'}
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          {/* Period Type */}
          <FormControl size="small" fullWidth>
            <InputLabel>Reporting Period</InputLabel>
            <Select value={periodType} label="Reporting Period" onChange={(e) => setPeriodType(e.target.value)}>
              <MenuItem value="all">All Available Records</MenuItem>
              <MenuItem value="daily">Daily View</MenuItem>
              <MenuItem value="weekly">Weekly View</MenuItem>
              <MenuItem value="monthly">Monthly View</MenuItem>
              <MenuItem value="quarterly">Quarterly View</MenuItem>
              <MenuItem value="custom">Custom Date Range</MenuItem>
            </Select>
          </FormControl>

          {/* Start Date */}
          <TextField
            size="small"
            label="From Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          {/* End Date */}
          <TextField
            size="small"
            label="To Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          {/* Post Office */}
          <FormControl size="small" fullWidth>
            <InputLabel>Post Office</InputLabel>
            <Select value={postOffice} label="Post Office" onChange={(e) => setPostOffice(e.target.value)}>
              <MenuItem value="">All Post Offices</MenuItem>
              {filterOptions.post_offices.map((po) => (
                <MenuItem key={po} value={po}>{po}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Designation */}
          <FormControl size="small" fullWidth>
            <InputLabel>Designation</InputLabel>
            <Select value={designation} label="Designation" onChange={(e) => setDesignation(e.target.value)}>
              <MenuItem value="">All Designations</MenuItem>
              {filterOptions.designations.map((d) => (
                <MenuItem key={d} value={d}>{d}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Work Category */}
          <FormControl size="small" fullWidth>
            <InputLabel>Work Category</InputLabel>
            <Select value={category} label="Work Category" onChange={(e) => setCategory(e.target.value)}>
              <MenuItem value="">All Categories</MenuItem>
              {filterOptions.work_categories.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Performance Status */}
          <FormControl size="small" fullWidth>
            <InputLabel>Performance Tier</InputLabel>
            <Select value={statusFilter} label="Performance Tier" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="all">All Tiers</MenuItem>
              <MenuItem value="on_track">On Track (≥80%)</MenuItem>
              <MenuItem value="needs_improvement">Needs Improvement (70-79%)</MenuItem>
              <MenuItem value="poor">Poor (&lt;70%)</MenuItem>
              <MenuItem value="unevaluated">Unevaluated</MenuItem>
            </Select>
          </FormControl>

          {/* Quick Presets */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label="2025 Holdout"
              size="small"
              onClick={() => {
                setPeriodType('all')
                setStartDate('2025-09-01')
                setEndDate('2025-12-22')
              }}
              clickable
              variant={startDate === '2025-09-01' ? 'filled' : 'outlined'}
              color="primary"
            />
            <Chip
              label="Latest 4 Weeks"
              size="small"
              onClick={() => {
                setPeriodType('weekly')
                setStartDate('2025-11-24')
                setEndDate('2025-12-19')
              }}
              clickable
              variant="outlined"
            />
            <Chip
              label="Reset"
              size="small"
              onClick={() => {
                setPeriodType('all')
                setStartDate('2025-09-01')
                setEndDate('2025-12-22')
                setPostOffice('')
                setDesignation('')
                setCategory('')
                setStatusFilter('all')
                setSearchQuery('')
              }}
              clickable
              variant="outlined"
            />
          </Box>
        </Box>
      </Paper>

      {/* 3. Provisional Formula Transparency Banner */}
      <Alert
        severity="info"
        icon={<Info size={20} color="#1677D2" />}
        sx={{
          bgcolor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 2,
          color: '#1E3A8A',
          '& .MuiAlert-message': { width: '100%' },
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formula.name || 'Provisional Sri Lanka Post KPI Formula'}:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label="40% Task Completion" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }} />
            <span style={{ color: '#60A5FA' }}>+</span>
            <Chip label="30% Quality Accuracy" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }} />
            <span style={{ color: '#60A5FA' }}>+</span>
            <Chip label="30% Delivery Timeliness" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }} />
            <span style={{ color: '#60A5FA' }}>=</span>
            <Chip label="100% Total KPI" size="small" sx={{ bgcolor: '#1E40AF', color: '#FFFFFF', fontWeight: 700 }} />
          </Box>
          <Typography variant="caption" sx={{ color: '#3B82F6', width: '100%', mt: 0.5 }}>
            Standard KPI Target: <strong>≥80.0% (On Track)</strong> · Minimum Performance Threshold: <strong>70.0% (Needs Improvement)</strong>. Values below 70.0% trigger supervisory review.
          </Typography>
        </Box>
      </Alert>

      {/* 4. 15 Executive KPI Summary Cards Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
          gap: 2,
        }}
      >
        {/* Card 1: Total Active Staff */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Active Employees
              </Typography>
              <Users size={16} color="#1677D2" />
            </Box>
            <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
              {summary.total_active_employees ?? '—'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Eligible staff in scope
            </Typography>
          </CardContent>
        </Card>

        {/* Card 2: Evaluated Employees */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Evaluated Staff
              </Typography>
              <UserCheck size={16} color="#2E7D32" />
            </Box>
            <Typography variant="h5" sx={{ color: '#2E7D32', fontWeight: 700 }}>
              {summary.evaluated_employees ?? '—'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              With verified KPI logs
            </Typography>
          </CardContent>
        </Card>

        {/* Card 3: Average Overall KPI */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2, bgcolor: '#FAF5FF', borderColor: '#E9D5FF' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#7E22CE', fontWeight: 600, textTransform: 'uppercase' }}>
                Average Overall KPI
              </Typography>
              <Award size={16} color="#9333EA" />
            </Box>
            <Typography variant="h5" sx={{ color: '#6B21A8', fontWeight: 700 }}>
              {formatPercent(summary.average_kpi_score)}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, summary.average_kpi_score || 0))}
                sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#F3E8FF', '& .MuiLinearProgress-bar': { bgcolor: '#9333EA' } }}
              />
              <Typography variant="caption" sx={{ color: '#7E22CE', fontWeight: 600 }}>
                Target: 80%
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Card 4: Meeting Target */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Meeting Target (≥80%)
              </Typography>
              <CheckCircle2 size={16} color="#2E7D32" />
            </Box>
            <Typography variant="h5" sx={{ color: '#2E7D32', fontWeight: 700 }}>
              {summary.meeting_target_count ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: '#2E7D32', fontWeight: 500 }}>
              On Track for bonus/clearance
            </Typography>
          </CardContent>
        </Card>

        {/* Card 5: Below Target */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Below Target (&lt;80%)
              </Typography>
              <AlertTriangle size={16} color="#ED6C02" />
            </Box>
            <Typography variant="h5" sx={{ color: summary.below_target_count > 0 ? '#ED6C02' : '#64748B', fontWeight: 700 }}>
              {summary.below_target_count ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Requires operational support
            </Typography>
          </CardContent>
        </Card>

        {/* Card 6: Unevaluated Count */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Unevaluated Staff
              </Typography>
              <HelpCircle size={16} color="#94A3B8" />
            </Box>
            <Typography variant="h5" sx={{ color: '#64748B', fontWeight: 700 }}>
              {summary.unevaluated_count ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Pending end-of-shift log
            </Typography>
          </CardContent>
        </Card>

        {/* Card 7: Average Completion */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Avg Completion
              </Typography>
              <Percent size={16} color="#1677D2" />
            </Box>
            <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
              {formatPercent(summary.average_completion_rate)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Weight: 40% in overall KPI
            </Typography>
          </CardContent>
        </Card>

        {/* Card 8: Average Accuracy */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Avg Accuracy
              </Typography>
              <Percent size={16} color="#0B1F3A" />
            </Box>
            <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
              {formatPercent(summary.average_accuracy_rate)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Weight: 30% in overall KPI
            </Typography>
          </CardContent>
        </Card>

        {/* Card 9: Average Timeliness */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Avg Timeliness
              </Typography>
              <Clock size={16} color="#1677D2" />
            </Box>
            <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
              {formatPercent(summary.average_timeliness_rate)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Weight: 30% in overall KPI
            </Typography>
          </CardContent>
        </Card>

        {/* Card 10: Total Assigned Tasks */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Assigned Workload
              </Typography>
              <Layers size={16} color="#0B1F3A" />
            </Box>
            <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
              {formatNum(summary.total_assigned_tasks)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Total tasks assigned
            </Typography>
          </CardContent>
        </Card>

        {/* Card 11: Completed Tasks */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Completed Work
              </Typography>
              <CheckCircle2 size={16} color="#2E7D32" />
            </Box>
            <Typography variant="h5" sx={{ color: '#2E7D32', fontWeight: 700 }}>
              {formatNum(summary.total_completed_tasks)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Successfully processed
            </Typography>
          </CardContent>
        </Card>

        {/* Card 12: Pending Tasks */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Pending Tasks
              </Typography>
              <Clock size={16} color="#ED6C02" />
            </Box>
            <Typography variant="h5" sx={{ color: summary.total_pending_tasks > 0 ? '#ED6C02' : '#0B1F3A', fontWeight: 700 }}>
              {formatNum(summary.total_pending_tasks)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Awaiting completion
            </Typography>
          </CardContent>
        </Card>

        {/* Card 13: Overdue Tasks */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Overdue / Late
              </Typography>
              <AlertCircle size={16} color="#E53935" />
            </Box>
            <Typography variant="h5" sx={{ color: summary.total_overdue_tasks > 0 ? '#E53935' : '#64748B', fontWeight: 700 }}>
              {summary.total_overdue_tasks ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Exceeded deadline
            </Typography>
          </CardContent>
        </Card>

        {/* Card 14: Attendance Rate */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Attendance Rate
              </Typography>
              <Calendar size={16} color="#1677D2" />
            </Box>
            <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
              {summary.attendance_rate !== null ? formatPercent(summary.attendance_rate) : '—'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              {summary.attendance_rate !== null ? 'Shift attendance' : 'Data unavailable'}
            </Typography>
          </CardContent>
        </Card>

        {/* Card 15: Requiring Review */}
        <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2, bgcolor: summary.requiring_review_count > 0 ? '#FFF5F5' : '#FFFFFF', borderColor: summary.requiring_review_count > 0 ? '#FED7D7' : '#E2E8F0' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: summary.requiring_review_count > 0 ? '#C53030' : '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Requiring Review
              </Typography>
              <AlertTriangle size={16} color={summary.requiring_review_count > 0 ? '#E53935' : '#94A3B8'} />
            </Box>
            <Typography variant="h5" sx={{ color: summary.requiring_review_count > 0 ? '#C53030' : '#64748B', fontWeight: 700 }}>
              {summary.requiring_review_count ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: summary.requiring_review_count > 0 ? '#C53030' : '#64748B', fontWeight: 500 }}>
              Supervisory review flagged
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 5. Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: '#E2E8F0' }} className="no-print">
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: 14 } }}>
          <Tab label={`Employee Performance (${filteredRows.length})`} />
          <Tab label="Historical Trends" />
          <Tab label="Workload & Capacity" />
          <Tab label="ML Forecast Telemetry" />
          <Tab label={`Team Alerts (${alerts.length})`} />
        </Tabs>
      </Box>

      {/* TAB 0: Employee Performance Table & Distribution */}
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Performance Distribution Chart Card */}
          <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ color: '#0B1F3A', fontWeight: 700, mb: 1.5 }}>
              POSTAL WORKFORCE KPI PERFORMANCE DISTRIBUTION
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Box sx={{ p: 2, bgcolor: '#F0FDF4', borderRadius: 2, border: '1px solid #DCFCE7' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#166534', fontWeight: 600 }}>On Track (≥80%)</Typography>
                  <Typography variant="body2" sx={{ color: '#166534', fontWeight: 700 }}>{distribution.on_track?.count || 0}</Typography>
                </Box>
                <LinearProgress variant="determinate" value={distribution.on_track?.percentage || 0} sx={{ height: 6, borderRadius: 3, bgcolor: '#DCFCE7', '& .MuiLinearProgress-bar': { bgcolor: '#16A34A' } }} />
                <Typography variant="caption" sx={{ color: '#15803D', mt: 0.5, display: 'block' }}>{distribution.on_track?.percentage || 0}% of active staff</Typography>
              </Box>

              <Box sx={{ p: 2, bgcolor: '#FFFBEB', borderRadius: 2, border: '1px solid #FEF3C7' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#92400E', fontWeight: 600 }}>Needs Improvement (70-79%)</Typography>
                  <Typography variant="body2" sx={{ color: '#92400E', fontWeight: 700 }}>{distribution.needs_improvement?.count || 0}</Typography>
                </Box>
                <LinearProgress variant="determinate" value={distribution.needs_improvement?.percentage || 0} sx={{ height: 6, borderRadius: 3, bgcolor: '#FEF3C7', '& .MuiLinearProgress-bar': { bgcolor: '#D97706' } }} />
                <Typography variant="caption" sx={{ color: '#B45309', mt: 0.5, display: 'block' }}>{distribution.needs_improvement?.percentage || 0}% of active staff</Typography>
              </Box>

              <Box sx={{ p: 2, bgcolor: '#FEF2F2', borderRadius: 2, border: '1px solid #FEE2E2' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#991B1B', fontWeight: 600 }}>Poor (&lt;70%)</Typography>
                  <Typography variant="body2" sx={{ color: '#991B1B', fontWeight: 700 }}>{distribution.poor?.count || 0}</Typography>
                </Box>
                <LinearProgress variant="determinate" value={distribution.poor?.percentage || 0} sx={{ height: 6, borderRadius: 3, bgcolor: '#FEE2E2', '& .MuiLinearProgress-bar': { bgcolor: '#DC2626' } }} />
                <Typography variant="caption" sx={{ color: '#B91C1C', mt: 0.5, display: 'block' }}>{distribution.poor?.percentage || 0}% of active staff</Typography>
              </Box>

              <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>Unevaluated</Typography>
                  <Typography variant="body2" sx={{ color: '#475569', fontWeight: 700 }}>{distribution.unevaluated?.count || 0}</Typography>
                </Box>
                <LinearProgress variant="determinate" value={distribution.unevaluated?.percentage || 0} sx={{ height: 6, borderRadius: 3, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: '#94A3B8' } }} />
                <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>{distribution.unevaluated?.percentage || 0}% of active staff</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Table Container */}
          <Paper elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, borderBottom: '1px solid #E2E8F0' }} className="no-print">
              <TextField
                size="small"
                placeholder="Search by name, ID, designation, or office…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ width: { xs: '100%', sm: 340 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} color="#94A3B8" />
                    </InputAdornment>
                  ),
                }}
              />
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Showing <strong>{filteredRows.length}</strong> postal officers
              </Typography>
            </Box>

            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell onClick={() => handleRequestSort('employee_id')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                      Employee ID {orderBy === 'employee_id' && (order === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell onClick={() => handleRequestSort('employee_name')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                      Officer Name {orderBy === 'employee_name' && (order === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell onClick={() => handleRequestSort('designation')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                      Designation
                    </TableCell>
                    <TableCell onClick={() => handleRequestSort('post_office')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                      Post Office
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRequestSort('completion_rate')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                      Completion (40%) {orderBy === 'completion_rate' && (order === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRequestSort('accuracy_rate')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                      Accuracy (30%) {orderBy === 'accuracy_rate' && (order === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRequestSort('timeliness_rate')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                      Timeliness (30%) {orderBy === 'timeliness_rate' && (order === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRequestSort('kpi_score')} sx={{ cursor: 'pointer', fontWeight: 700, bgcolor: '#F8FAFC' }}>
                      Overall KPI {orderBy === 'kpi_score' && (order === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Change (vs Prior)
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      Performance Status
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }} className="no-print">
                      Action
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => (
                    <TableRow
                      key={row.employee_id}
                      hover
                      onClick={() => handleRowClick(row)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F8FAFC' } }}
                    >
                      <TableCell sx={{ fontWeight: 600, color: '#1677D2' }}>
                        {row.employee_id}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#0B1F3A' }}>
                        {row.employee_name}
                      </TableCell>
                      <TableCell sx={{ color: '#475569' }}>
                        {row.designation}
                      </TableCell>
                      <TableCell sx={{ color: '#475569' }}>
                        {row.post_office}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>
                        {formatPercent(row.completion_rate)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>
                        {formatPercent(row.accuracy_rate)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>
                        {formatPercent(row.timeliness_rate)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.9rem', color: row.kpi_score >= 80 ? '#2E7D32' : row.kpi_score >= 70 ? '#E65100' : row.kpi_score !== null ? '#C62828' : '#94A3B8', bgcolor: '#F8FAFC' }}>
                        {formatPercent(row.kpi_score)}
                      </TableCell>
                      <TableCell align="right">
                        {renderDelta(row.kpi_change)}
                      </TableCell>
                      <TableCell align="center">
                        {getStatusChip(row.performance_status)}
                      </TableCell>
                      <TableCell align="center" className="no-print" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Eye size={14} />}
                          onClick={() => handleRowClick(row)}
                          sx={{ borderColor: '#CBD5E1', color: '#1677D2', fontSize: '0.75rem', py: 0.25 }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} sx={{ py: 6, textAlign: 'center' }}>
                        <EmptyState title="No employee records found">
                          No postal officers match the selected reporting period and filter criteria.
                        </EmptyState>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filteredRows.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              className="no-print"
            />
          </Paper>
        </Box>
      )}

      {/* TAB 1: Historical Trends */}
      {activeTab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 2 }}>
            <Typography variant="h6" sx={{ color: '#0B1F3A', fontWeight: 700, mb: 1 }}>
              HISTORICAL KPI & COMPONENT TREND ANALYSIS
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
              Weekly performance observations derived directly from MongoDB daily logs. Displays overall KPI along with completion, accuracy, and timeliness component trajectories.
            </Typography>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Observation Week</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Overall KPI (%)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Task Completion (%)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Accuracy (%)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Timeliness (%)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Tasks Assigned</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Tasks Completed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historicalTrends.map((t) => (
                    <TableRow key={t.week} hover>
                      <TableCell sx={{ fontWeight: 600, color: '#1677D2' }}>{t.week}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: t.overall_kpi >= 80 ? '#2E7D32' : '#C62828' }}>
                        {formatPercent(t.overall_kpi)}
                      </TableCell>
                      <TableCell align="right">{formatPercent(t.completion_rate)}</TableCell>
                      <TableCell align="right">{formatPercent(t.accuracy_rate)}</TableCell>
                      <TableCell align="right">{formatPercent(t.timeliness_rate)}</TableCell>
                      <TableCell align="right">{formatNum(t.assigned_work_count)}</TableCell>
                      <TableCell align="right">{formatNum(t.completed_work_count)}</TableCell>
                    </TableRow>
                  ))}
                  {historicalTrends.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 4, textAlign: 'center', color: '#64748B' }}>
                        No historical trend observations recorded for this date range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* TAB 2: Workload & Capacity */}
      {activeTab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 2 }}>
            <Typography variant="h6" sx={{ color: '#0B1F3A', fontWeight: 700, mb: 1 }}>
              WORKLOAD DISTRIBUTION & CAPACITY OPTIMIZATION
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
              Integrates task allocations and clearance status. High workload is flagged when assignments exceed 115% of team average; underutilized staff are identified when below 85%.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
              <Card elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Total Assigned Work</Typography>
                <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700, mt: 0.5 }}>{formatNum(workload.total_assigned)}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Tasks across selected period</Typography>
              </Card>

              <Card elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Workload Clearance Rate</Typography>
                <Typography variant="h5" sx={{ color: '#2E7D32', fontWeight: 700, mt: 0.5 }}>{formatPercent(workload.completion_rate)}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>{formatNum(workload.total_completed)} completed tasks</Typography>
              </Card>

              <Card elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Average Load / Officer</Typography>
                <Typography variant="h5" sx={{ color: '#1677D2', fontWeight: 700, mt: 0.5 }}>{formatNum(workload.average_workload_per_officer)}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Standard baseline capacity</Typography>
              </Card>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Officer ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Officer Name</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Assigned</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Completed</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Pending</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Clearance Rate</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Workload Intensity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(workload.distribution || []).map((w) => (
                    <TableRow key={w.employee_id} hover>
                      <TableCell sx={{ fontWeight: 600, color: '#1677D2' }}>{w.employee_id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{w.employee_name}</TableCell>
                      <TableCell align="right">{formatNum(w.assigned)}</TableCell>
                      <TableCell align="right">{formatNum(w.completed)}</TableCell>
                      <TableCell align="right" sx={{ color: w.pending > 0 ? '#E65100' : '#475569', fontWeight: w.pending > 0 ? 600 : 400 }}>
                        {formatNum(w.pending)}
                      </TableCell>
                      <TableCell align="right">{formatPercent(w.completion_rate)}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={w.workload_intensity}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            bgcolor: w.workload_intensity === 'High' ? '#FEF2F2' : w.workload_intensity === 'Light' ? '#EFF6FF' : '#F0FDF4',
                            color: w.workload_intensity === 'High' ? '#DC2626' : w.workload_intensity === 'Light' ? '#2563EB' : '#16A34A',
                            border: '1px solid',
                            borderColor: w.workload_intensity === 'High' ? '#FCA5A5' : w.workload_intensity === 'Light' ? '#BFDBFE' : '#86EFAC',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* TAB 3: ML Forecast Telemetry */}
      {activeTab === 3 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Sparkles size={20} color="#1677D2" />
              <Typography variant="h6" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
                TRAINED KPI FORECASTING MODEL TELEMETRY
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
              Connected to the production ML pipeline artifact <code>{modelTelemetry.model_version}</code>. Generates next-week KPI predictions by evaluating historical work logs, overtime, route metrics, and attendance.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
              <Card elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Active Model</Typography>
                <Typography variant="h6" sx={{ color: '#0B1F3A', fontWeight: 700, mt: 0.5 }}>Gradient Boosting</Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>HistGradientBoosting</Typography>
              </Card>

              <Card elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Mean Absolute Error (MAE)</Typography>
                <Typography variant="h5" sx={{ color: '#1677D2', fontWeight: 700, mt: 0.5 }}>{modelTelemetry.mae}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>On 1,056 holdout samples</Typography>
              </Card>

              <Card elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Root Mean Squared Error</Typography>
                <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700, mt: 0.5 }}>{modelTelemetry.rmse}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Holdout RMSE</Typography>
              </Card>

              <Card elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Coefficient of Det. (R²)</Typography>
                <Typography variant="h5" sx={{ color: '#2E7D32', fontWeight: 700, mt: 0.5 }}>{modelTelemetry.r2}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Not accuracy score</Typography>
              </Card>
            </Box>

            <Typography variant="subtitle2" sx={{ color: '#0B1F3A', fontWeight: 700, mb: 1.5 }}>
              LATEST PREDICTED OFFICER TRAJECTORIES
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Officer ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Officer Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Source Week</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Target Week</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Observed Actual KPI</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Predicted Next-Week KPI</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Expected Delta</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Forecast Category</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rawRows.map((r) => {
                    const fc = r.forecast || {}
                    return (
                      <TableRow key={r.employee_id} hover>
                        <TableCell sx={{ fontWeight: 600, color: '#1677D2' }}>{r.employee_id}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{r.employee_name}</TableCell>
                        <TableCell>{fc.source_week || '—'}</TableCell>
                        <TableCell>{fc.forecast_week || '—'}</TableCell>
                        <TableCell align="right">{formatPercent(fc.latest_actual_kpi)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#1677D2' }}>{formatPercent(fc.predicted_kpi)}</TableCell>
                        <TableCell align="right">{renderDelta(fc.predicted_change)}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={fc.monitoring_category || 'Available'}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              bgcolor: fc.monitoring_category === 'Improving' ? '#F0FDF4' : fc.monitoring_category === 'Needs Review' ? '#FEF2F2' : '#F8FAFC',
                              color: fc.monitoring_category === 'Improving' ? '#16A34A' : fc.monitoring_category === 'Needs Review' ? '#DC2626' : '#475569',
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* TAB 4: Team Alerts */}
      {activeTab === 4 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {alerts.map((a, i) => (
            <Alert
              key={i}
              severity={a.severity === 'critical' ? 'error' : a.severity === 'warning' ? 'warning' : 'info'}
              sx={{ borderRadius: 2 }}
              action={
                a.employee_id && (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => {
                      const emp = rawRows.find((r) => r.employee_id === a.employee_id)
                      if (emp) handleRowClick(emp)
                    }}
                  >
                    View Staff
                  </Button>
                )
              }
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{a.title}</Typography>
              <Typography variant="body2">{a.message}</Typography>
            </Alert>
          ))}
          {alerts.length === 0 && (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px solid #E2E8F0', borderRadius: 2 }}>
              <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 12px' }} />
              <Typography variant="h6" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
                No Critical Performance Flags Detected
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B' }}>
                All evaluated postal officers are currently performing within expected operational boundaries.
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* 6. Employee KPI Detail Slide-out Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 460, md: 520 }, p: 3, bgcolor: '#FFFFFF' },
        }}
      >
        {selectedEmployee && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box>
                <Chip label={selectedEmployee.employee_id} size="small" sx={{ bgcolor: '#EFF6FF', color: '#1677D2', fontWeight: 700, mb: 1 }} />
                <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
                  {selectedEmployee.employee_name}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                  {selectedEmployee.designation} · {selectedEmployee.post_office}
                </Typography>
              </Box>
              <IconButton onClick={() => setDrawerOpen(false)}>
                <X size={20} />
              </IconButton>
            </Box>

            <Divider />

            {/* Score Summary Box */}
            <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0', textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                Overall Evaluated KPI Score
              </Typography>
              <Typography variant="h3" sx={{ color: selectedEmployee.kpi_score >= 80 ? '#2E7D32' : selectedEmployee.kpi_score >= 70 ? '#E65100' : selectedEmployee.kpi_score !== null ? '#C62828' : '#94A3B8', fontWeight: 800, my: 0.5 }}>
                {formatPercent(selectedEmployee.kpi_score)}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, alignItems: 'center' }}>
                {getStatusChip(selectedEmployee.performance_status)}
                {selectedEmployee.kpi_change !== null && (
                  <Chip
                    label={`Delta: ${selectedEmployee.kpi_change > 0 ? '+' : ''}${selectedEmployee.kpi_change}%`}
                    size="small"
                    sx={{ bgcolor: '#FFFFFF', border: '1px solid #CBD5E1', fontWeight: 600 }}
                  />
                )}
              </Box>
            </Box>

            {/* Component Breakdown */}
            <Typography variant="subtitle2" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
              KPI COMPONENT BREAKDOWN
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
              <Box sx={{ p: 1.5, border: '1px solid #E2E8F0', borderRadius: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Completion (40%)</Typography>
                <Typography variant="h6" sx={{ color: '#0B1F3A', fontWeight: 700, mt: 0.5 }}>
                  {formatPercent(selectedEmployee.completion_rate)}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, border: '1px solid #E2E8F0', borderRadius: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Accuracy (30%)</Typography>
                <Typography variant="h6" sx={{ color: '#0B1F3A', fontWeight: 700, mt: 0.5 }}>
                  {formatPercent(selectedEmployee.accuracy_rate)}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, border: '1px solid #E2E8F0', borderRadius: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Timeliness (30%)</Typography>
                <Typography variant="h6" sx={{ color: '#0B1F3A', fontWeight: 700, mt: 0.5 }}>
                  {formatPercent(selectedEmployee.timeliness_rate)}
                </Typography>
              </Box>
            </Box>

            {/* Operational Workload */}
            <Typography variant="subtitle2" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
              OPERATIONAL WORKLOAD & CLEARANCE
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
              <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Assigned Work</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#0B1F3A' }}>{formatNum(selectedEmployee.assigned_tasks)} Tasks</Typography>
              </Box>
              <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Completed Work</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#2E7D32' }}>{formatNum(selectedEmployee.completed_tasks)} Tasks</Typography>
              </Box>
              <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Pending Workload</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: selectedEmployee.pending_tasks > 0 ? '#E65100' : '#475569' }}>
                  {formatNum(selectedEmployee.pending_tasks)} Tasks
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#64748B' }}>Attendance Summary</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#0B1F3A' }}>{selectedEmployee.attendance_summary}</Typography>
              </Box>
            </Box>

            {/* ML Next-Week Forecast Card */}
            {selectedEmployee.forecast && (
              <Box sx={{ p: 2, bgcolor: '#EFF6FF', borderRadius: 2, border: '1px solid #BFDBFE' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Sparkles size={16} color="#1677D2" />
                  <Typography variant="subtitle2" sx={{ color: '#1E3A8A', fontWeight: 700 }}>
                    ML Forecast (Target: {selectedEmployee.forecast.forecast_week || 'Next Week'})
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: '#1E40AF' }}>Predicted Next-Week KPI:</Typography>
                  <Typography variant="h6" sx={{ color: '#1677D2', fontWeight: 700 }}>
                    {formatPercent(selectedEmployee.forecast.predicted_kpi)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#1E40AF' }}>Predicted Change:</Typography>
                  {renderDelta(selectedEmployee.forecast.predicted_change)}
                </Box>
                {selectedEmployee.forecast.recommendation && (
                  <Typography variant="caption" sx={{ color: '#1E3A8A', display: 'block', bgcolor: '#FFFFFF', p: 1.5, borderRadius: 1, border: '1px solid #DBEAFE' }}>
                    <strong>Department Recommendation:</strong> {selectedEmployee.forecast.recommendation}
                  </Typography>
                )}
              </Box>
            )}

            <Button
              variant="contained"
              fullWidth
              onClick={() => setDrawerOpen(false)}
              sx={{ bgcolor: '#0B1F3A', color: '#FFFFFF', mt: 'auto' }}
            >
              Close Details
            </Button>
          </Box>
        )}
      </Drawer>
    </Box>
  )
}
