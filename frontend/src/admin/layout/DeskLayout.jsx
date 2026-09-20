import { NavLink, Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import Stack from '@mui/material/Stack'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import FingerprintOutlinedIcon from '@mui/icons-material/FingerprintOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

const DRAWER_WIDTH = 240

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
]

export default function DeskLayout({ onResetSeed, resetting }) {
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

          <Box>
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
                  sx={{
                    borderRadius: 1,
                    mb: 0.25,
                    '&.active': {
                      bgcolor: 'rgba(36, 144, 239, 0.1)',
                      color: 'primary.main',
                      '& .MuiListItemIcon-root': { color: 'primary.main' },
                    },
                  }}
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
          </Box>

          <Box sx={{ mt: 'auto' }}>
            <Divider sx={{ mb: 1.5 }} />
            <Button
              fullWidth
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<RestartAltIcon />}
              onClick={onResetSeed}
              disabled={resetting}
              sx={{ borderColor: 'divider', color: 'text.secondary' }}
            >
              {resetting ? 'Resetting…' : 'Reset to seed'}
            </Button>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1, px: 0.5 }}
            >
              Auth & Postgres later
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
