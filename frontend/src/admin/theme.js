import { createTheme } from '@mui/material/styles'

/** Sri Lanka Post / Post-Assist LK official government design system theme */
export const frappeTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1677D2',
      dark: '#0B1F3A',
      light: '#42A5F5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0B1F3A',
      light: '#1E3A5F',
      contrastText: '#ffffff',
    },
    error: {
      main: '#E53935',
      light: '#EF5350',
      dark: '#C62828',
    },
    warning: {
      main: '#ED6C02',
      light: '#FF9800',
    },
    success: {
      main: '#2E7D32',
      light: '#4CAF50',
    },
    background: {
      default: '#F3F6FB',
      paper: '#ffffff',
    },
    text: {
      primary: '#0B1F3A',
      secondary: '#475569',
    },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 13.5,
    h5: { fontWeight: 700, fontSize: '1.25rem', color: '#0B1F3A' },
    h6: { fontWeight: 600, fontSize: '0.95rem', color: '#0B1F3A' },
    subtitle2: { fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em', color: '#475569' },
    body2: { fontSize: '0.8125rem', color: '#334155' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#F3F6FB',
          color: '#0B1F3A',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          fontWeight: 600,
        },
        containedPrimary: {
          backgroundColor: '#1677D2',
          '&:hover': { backgroundColor: '#0B1F3A', boxShadow: 'none' },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #E2E8F0',
          backgroundImage: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#F8FAFC',
          color: '#475569',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'capitalize',
          borderBottom: '1px solid #E2E8F0',
          whiteSpace: 'nowrap',
          py: 1,
        },
        body: {
          fontSize: '0.8125rem',
          borderBottom: '1px solid #F1F5F9',
          whiteSpace: 'nowrap',
          py: 1,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
        fullWidth: true,
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          borderRadius: 8,
          '& fieldset': { borderColor: '#CBD5E1' },
          '&:hover fieldset': { borderColor: '#1677D2' },
          '&.Mui-focused fieldset': { borderColor: '#1677D2' },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #E2E8F0',
          backgroundColor: '#ffffff',
        },
      },
    },
  },
})

export default frappeTheme
