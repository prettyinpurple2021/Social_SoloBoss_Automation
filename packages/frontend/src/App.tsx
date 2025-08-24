
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Auth/Login';
import { Dashboard } from './components/Dashboard/Dashboard';
import { Settings } from './components/Settings/Settings';
import { PWAUpdateNotification } from './components/PWA/PWAUpdateNotification';
import { MobileNavigation, useMobileNavigation } from './components/Mobile/MobileNavigation';
import { MobilePostEditor } from './components/Mobile/MobilePostEditor';
import { useResponsive } from './hooks/useResponsive';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#f093fb',
      light: '#f8b5ff',
      dark: '#d65db1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#4facfe',
      light: '#7bc4ff',
      dark: '#2d8bc7',
      contrastText: '#ffffff',
    },
    background: {
      default: 'transparent',
      paper: 'rgba(255, 255, 255, 0.95)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#e0e0e0',
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  typography: {
    fontFamily: '"Kalnia Glaze", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Kalnia Glaze", serif',
      fontSize: '3.5rem',
      fontWeight: 500,
      background: 'linear-gradient(45deg, #f093fb, #f5576c)',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      textAlign: 'center',
      marginBottom: '1rem',
      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.5)',
      filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.8))'
    },
    h2: {
      fontFamily: '"Kalnia Glaze", serif',
      fontSize: '2.5rem',
      fontWeight: 500,
      background: 'linear-gradient(45deg, #667eea, #764ba2)',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 0, 0, 0.5)',
      filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.8))'
    },
    h3: {
      fontFamily: '"Kalnia Glaze", serif',
      fontSize: '2rem',
      fontWeight: 500,
      background: 'linear-gradient(45deg, #4facfe, #00f2fe)',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      textShadow: '1px 1px 3px rgba(0, 0, 0, 0.8), 0 0 10px rgba(0, 0, 0, 0.5)',
      filter: 'drop-shadow(1px 1px 3px rgba(0, 0, 0, 0.8))'
    },
    h4: {
      fontFamily: '"Kalnia Glaze", serif',
      fontSize: '1.5rem',
      fontWeight: 500,
      color: '#ffffff',
      textShadow: '1px 1px 3px rgba(0, 0, 0, 0.8)'
    },
    h5: {
      fontFamily: '"Kalnia Glaze", serif',
      fontSize: '1.25rem',
      fontWeight: 500,
      color: '#ffffff',
      textShadow: '1px 1px 3px rgba(0, 0, 0, 0.8)'
    },
    h6: {
      fontFamily: '"Kalnia Glaze", serif',
      fontSize: '1.125rem',
      fontWeight: 500,
      color: '#ffffff',
      textShadow: '1px 1px 3px rgba(0, 0, 0, 0.8)'
    },
    body1: {
      fontFamily: '"Kalnia Glaze", serif',
      fontSize: '1.1rem',
      lineHeight: 1.6,
      color: '#ffffff',
      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
    },
    body2: {
      fontFamily: '"Kalnia Glaze", serif',
      fontSize: '1rem',
      lineHeight: 1.5,
      color: '#e0e0e0',
      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
    },
    button: {
      fontFamily: '"Kalnia Glaze", serif',
      fontSize: '1rem',
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '25px',
          padding: '12px 24px',
          fontSize: '1.1rem',
          fontWeight: 500,
          textTransform: 'none',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
          },
        },
        contained: {
          background: 'linear-gradient(45deg, #f093fb, #f5576c)',
          '&:hover': {
            background: 'linear-gradient(45deg, #f5576c, #4facfe)',
          },
        },
        outlined: {
          border: '2px solid',
          borderImage: 'linear-gradient(45deg, #f093fb, #f5576c) 1',
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(45deg, #f093fb, #f5576c)',
            color: 'white',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(26, 26, 46, 0.95)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(26, 26, 46, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'rgba(26, 26, 46, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: '"Kalnia Glaze", serif',
          fontSize: '1.1rem',
          fontWeight: 500,
          textTransform: 'none',
          color: '#ffffff',
          textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
          '&.Mui-selected': {
            background: 'linear-gradient(45deg, #f093fb, #f5576c)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '15px',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            color: '#ffffff',
            fontSize: '1rem',
            minHeight: '44px', // Touch-friendly minimum height
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.15)',
            },
            '&.Mui-focused': {
              background: 'rgba(255, 255, 255, 0.2)',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.5)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#f093fb',
            },
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.8)',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#f093fb',
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          minHeight: '56px',
          minWidth: '56px',
          '&:active': {
            transform: 'scale(0.95)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minHeight: '44px',
          minWidth: '44px',
          '&:active': {
            transform: 'scale(0.95)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          minHeight: '36px',
          fontSize: '0.9rem',
          '&:active': {
            transform: 'scale(0.95)',
          },
        },
      },
    },
  },
});

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { isMobile } = useResponsive();
  const {
    isCreatePostOpen,
    notificationCount,
    handleCreatePost,
    handleCloseCreatePost
  } = useMobileNavigation();

  const handleSavePost = async (postData: any) => {
    // TODO: Implement post saving logic
    console.log('Saving post:', postData);
    // This would typically call an API to save the post
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        <CircularProgress size={60} sx={{ color: 'white' }} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Router>
      {/* PWA Update Notifications */}
      <PWAUpdateNotification />
      
      {/* Mobile Navigation */}
      {isMobile && (
        <MobileNavigation
          onCreatePost={handleCreatePost}
          notificationCount={notificationCount}
        />
      )}

      {/* Main Content */}
      <Box sx={{ 
        pt: isMobile ? 8 : 0, // Account for mobile app bar
        pb: isMobile ? 7 : 0  // Account for mobile bottom navigation
      }}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/analytics" element={<div>Analytics Page (TODO)</div>} />
          <Route path="/schedule" element={<div>Schedule Page (TODO)</div>} />
          <Route path="/connections" element={<div>Connections Page (TODO)</div>} />
          <Route path="/profile" element={<div>Profile Page (TODO)</div>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Box>

      {/* Mobile Post Editor */}
      <MobilePostEditor
        open={isCreatePostOpen}
        onClose={handleCloseCreatePost}
        onSave={handleSavePost}
      />
    </Router>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;