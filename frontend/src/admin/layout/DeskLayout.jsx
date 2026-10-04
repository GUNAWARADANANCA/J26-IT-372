import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import Stack from '@mui/material/Stack'
import Collapse from '@mui/material/Collapse'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import FingerprintOutlinedIcon from '@mui/icons-material/FingerprintOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import CelebrationOutlinedIcon from '@mui/icons-material/CelebrationOutlined'
import MoreTimeOutlinedIcon from '@mui/icons-material/MoreTimeOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined'
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined'
import FamilyRestroomOutlinedIcon from '@mui/icons-material/FamilyRestroomOutlined'
import ElderlyOutlinedIcon from '@mui/icons-material/ElderlyOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'

const DRAWER_WIDTH = 260

const nav = [
  {
    to: '/employee',
    label: 'Employee',
    desc: 'Master',
    icon: <PeopleAltOutlinedIcon fontSize="small" />,
  },
  {
    to: '/daily-kpi-log',
    label: 'Daily KPI Log',
    desc: 'Transaction',
    icon: <AssessmentOutlinedIcon fontSize="small" />,
  },
  {
    to: '/attendance-log',
    label: 'Attendance Logs',
    desc: 'Fingerprint',
    icon: <FingerprintOutlinedIcon fontSize="small" />,
  },
  {
    to: '/settings',
    label: 'Settings',
    desc: 'Office location',
    icon: <SettingsOutlinedIcon fontSize="small" />,
  },
]

const entitlements = [
  { to: '/entitlements', label: 'Dashboard', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/payroll', label: 'Salary & Payroll', icon: <PaymentsOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/leave', label: 'Leave Management', icon: <EventAvailableOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/holiday-pay', label: 'Holiday Pay', icon: <CelebrationOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/overtime', label: 'Overtime', icon: <MoreTimeOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/epf', label: 'EPF', icon: <AccountBalanceOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/etf', label: 'ETF', icon: <SavingsOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/gratuity', label: 'Gratuity', icon: <CardGiftcardOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/promotions', label: 'Promotions', icon: <TrendingUpOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/transfers', label: 'Transfers', icon: <SwapHorizOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/family-benefits', label: 'Maternity / Family Benefits', icon: <FamilyRestroomOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/retirement', label: 'Retirement', icon: <ElderlyOutlinedIcon fontSize="small" /> },
  { to: '/entitlements/loans', label: 'Loans / Advances', icon: <AccountBalanceWalletOutlinedIcon fontSize="small" /> },
]

const itemSx = {
  borderRadius: 1,
  mb: 0.25,
  '&.active': {
    bgcolor: 'rgba(36, 144, 239, 0.1)',
    color: 'primary.main',
    '& .MuiListItemIcon-root': { color: 'primary.main' },
  },
}

export default function DeskLayout() {
  const location = useLocation()
  const [openEntitlements, setOpenEntitlements] = useState(
    location.pathname.startsWith('/entitlements'),
  )

  useEffect(() => {
    if (location.pathname.startsWith('/entitlements')) setOpenEntitlements(true)
  }, [location.pathname])
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        <Stack spacing={2} sx={{ p: 2, height: '100%' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: 'primary.main',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              SL
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                Postal KPI
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Desk
              </Typography>
            </Box>
          </Stack>

          <Divider />

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ px: 1, mb: 0.5, textTransform: 'uppercase' }}
            >
              Modules
            </Typography>
            <List dense disablePadding>
              {nav.map((item) => (
                <ListItemButton
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  sx={itemSx}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={item.desc}
                    primaryTypographyProps={{ fontWeight: 550, fontSize: 13.5 }}
                    secondaryTypographyProps={{ fontSize: 11 }}
                  />
                </ListItemButton>
              ))}
            </List>
            <ListItemButton
              onClick={() => setOpenEntitlements((open) => !open)}
              sx={{ borderRadius: 1, mt: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                <PaymentsOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Employee Entitlements"
                primaryTypographyProps={{ fontWeight: 550, fontSize: 13.5 }}
              />
              {openEntitlements ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </ListItemButton>
            <Collapse in={openEntitlements} timeout="auto" unmountOnExit>
              <List dense disablePadding sx={{ pl: 1 }}>
                {entitlements.map((item) => (
                  <ListItemButton
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    end={item.to === '/entitlements'}
                    sx={itemSx}
                  >
                    <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontWeight: 550, fontSize: 12.5 }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </Box>

          <Box sx={{ mt: 'auto' }}>
            <Divider sx={{ mb: 1.5 }} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1, px: 0.5 }}
            >
              MongoDB connected
            </Typography>
          </Box>
        </Stack>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: '#ffffff',
          p: { xs: 2, md: 3 },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
