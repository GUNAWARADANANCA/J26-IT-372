import { createTheme } from '@mui/material/styles'

/** ERPNext / Frappe Desk inspired theme on top of Material UI */
export const frappeTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2490ef',
      dark: '#1a7fd4',
      light: '#5aaef5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c7c7c',
    },
    error: {
      main: '#e24c4c',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#36414c',
      secondary: '#6c7680',
    },
    divider: '#e3e8ee',
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 13.5,
    h5: { fontWeight: 600, fontSize: '1.25rem', color: '#2b333b' },
    h6: { fontWeight: 600, fontSize: '0.95rem', color: '#2b333b' },
    subtitle2: { fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em' },
    body2: { fontSize: '0.8125rem' },
    button: { textTransform: 'none', fontWeight: 550 },
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#ffffff',
          color: '#36414c',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          boxShadow: 'none',
        },
        containedPrimary: {
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #e3e8ee',
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#f8f9fa',
          color: '#6c7680',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'capitalize',
          borderBottom: '1px solid #e3e8ee',
          whiteSpace: 'nowrap',
          py: 1,
        },
        body: {
          fontSize: '0.8125rem',
          borderBottom: '1px solid #eef1f3',
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
          '& fieldset': { borderColor: '#d1d8dd' },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #e3e8ee',
          backgroundColor: '#ffffff',
        },
      },
    },
  },
})

export default frappeTheme
