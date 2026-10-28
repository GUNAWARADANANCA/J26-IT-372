import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export default function FormSection({ label, children }) {
  return (
    <Paper sx={{ mb: 1.5, overflow: 'hidden' }}>
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: '#f8f9fa',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" sx={{ textTransform: 'none', letterSpacing: 0 }}>
          {label}
        </Typography>
      </Box>
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexWrap: 'wrap',
          margin: -1,
        }}
      >
        {children}
      </Box>
    </Paper>
  )
}
