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
  Add
} from '@mui/icons-material';
import { PostsList } from './PostsList';
import { CalendarView } from './CalendarView';
import { PlatformConnections } from './PlatformConnections';
import { PostForm } from './PostForm';


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
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Social Media Automation
          </Typography>
          <Button
            color="inherit"
            startIcon={<Add />}
            onClick={handleCreatePost}
            sx={{ mr: 2 }}
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
            color="inherit"
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
            <MenuItem onClick={handleMenuClose}>Profile</MenuItem>
            <MenuItem onClick={handleMenuClose}>Settings</MenuItem>
            <MenuItem onClick={handleMenuClose}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2 }}>
        <Paper elevation={2}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="dashboard tabs"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              icon={<DashboardIcon />}
              label="Posts"
              id="dashboard-tab-0"
              aria-controls="dashboard-tabpanel-0"
            />
            <Tab
              icon={<CalendarMonth />}
              label="Calendar"
              id="dashboard-tab-1"
              aria-controls="dashboard-tabpanel-1"
            />
            <Tab
              icon={<Settings />}
              label="Platforms"
              id="dashboard-tab-2"
              aria-controls="dashboard-tabpanel-2"
            />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <PostsList />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <CalendarView />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
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