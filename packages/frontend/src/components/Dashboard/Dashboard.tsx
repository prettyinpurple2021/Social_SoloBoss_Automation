import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Paper
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  CalendarMonth,
  Settings,
  AccountCircle,
  Add,
  AutoAwesome,
  Analytics
} from '@mui/icons-material';
import { PostsList } from './PostsList';
import { CalendarView } from './CalendarView';
import { PlatformConnections } from './PlatformConnections';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { PostForm } from './PostForm';
import { useAuth } from '../../contexts/AuthContext';


interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const Dashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [showPostForm, setShowPostForm] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuth();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCreatePost = () => {
    setShowPostForm(true);
  };

  const handlePostFormClose = () => {
    setShowPostForm(false);
  };

  const handlePostSubmit = (postData: any) => {
    // TODO: Implement post creation API call
    console.log('Creating post:', postData);
    setShowPostForm(false);
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <AutoAwesome sx={{ 
              mr: 2, 
              fontSize: '2rem',
              background: 'linear-gradient(45deg, #f093fb, #f5576c)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }} />
            <Typography 
              variant="h4" 
              component="div" 
              sx={{ 
                flexGrow: 1,
                fontFamily: '"Kalnia Glaze", serif',
                background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 500
              }}
            >
              SoloBoss Automation
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreatePost}
            sx={{ 
              mr: 2,
              background: 'linear-gradient(45deg, #4facfe, #00f2fe)',
              '&:hover': {
                background: 'linear-gradient(45deg, #00f2fe, #4facfe)',
              }
            }}
          >
            Create Post
          </Button>
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenuOpen}
            sx={{
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(45deg, #764ba2, #667eea)',
                transform: 'scale(1.1)',
              }
            }}
          >
            <AccountCircle />
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              Profile ({user?.name})
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); window.location.href = '/settings'; }}>
              Settings
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); logout(); }}>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* Hero Section */}
        <Box sx={{ 
          textAlign: 'center', 
          mb: 4,
          p: 4,
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '30px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
        }}>
          <Typography variant="h1" sx={{ mb: 2 }}>
            Girl Boss Automation
          </Typography>
          <Typography variant="h5" sx={{ 
            color: 'rgba(255, 255, 255, 0.9)',
            fontFamily: '"Kalnia Glaze", serif',
            fontWeight: 500
          }}>
            Automate your social media presence with style and power! ✨
          </Typography>
        </Box>

        <Paper elevation={2} sx={{ borderRadius: '25px', overflow: 'hidden' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="dashboard tabs"
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              background: 'linear-gradient(45deg, rgba(240, 147, 251, 0.1), rgba(79, 172, 254, 0.1))',
              '& .MuiTabs-indicator': {
                background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                height: '4px',
                borderRadius: '2px'
              }
            }}
          >
            <Tab
              icon={<DashboardIcon />}
              label="Posts"
              id="dashboard-tab-0"
              aria-controls="dashboard-tabpanel-0"
              sx={{
                fontSize: '1.1rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }
              }}
            />
            <Tab
              icon={<CalendarMonth />}
              label="Calendar"
              id="dashboard-tab-1"
              aria-controls="dashboard-tabpanel-1"
              sx={{
                fontSize: '1.1rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }
              }}
            />
            <Tab
              icon={<Analytics />}
              label="Analytics"
              id="dashboard-tab-2"
              aria-controls="dashboard-tabpanel-2"
              sx={{
                fontSize: '1.1rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }
              }}
            />
            <Tab
              icon={<Settings />}
              label="Platforms"
              id="dashboard-tab-3"
              aria-controls="dashboard-tabpanel-3"
              sx={{
                fontSize: '1.1rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }
              }}
            />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <PostsList />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <CalendarView />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <AnalyticsDashboard />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <PlatformConnections />
          </TabPanel>
        </Paper>
      </Container>

      <PostForm
        open={showPostForm}
        onClose={handlePostFormClose}
        onSubmit={handlePostSubmit}
      />
    </Box>
  );
};