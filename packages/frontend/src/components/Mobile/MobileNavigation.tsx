import React, { useState } from 'react';
import {
  BottomNavigation,
  BottomNavigationAction,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  Badge,
  Fab
} from '@mui/material';
import {
  Dashboard,
  PostAdd,
  Analytics,
  Settings,
  Menu,
  Notifications,
  AccountCircle,
  Schedule,
  Link as LinkIcon,
  Add
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useResponsive } from '../../hooks/useResponsive';
import { HapticUtils } from '../../utils/mobile';

interface MobileNavigationProps {
  onCreatePost?: () => void;
  notificationCount?: number;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  onCreatePost,
  notificationCount = 0
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useResponsive();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const bottomNavItems = [
    { label: 'Dashboard', value: '/dashboard', icon: Dashboard },
    { label: 'Analytics', value: '/analytics', icon: Analytics },
    { label: 'Schedule', value: '/schedule', icon: Schedule },
    { label: 'Settings', value: '/settings', icon: Settings }
  ];

  const drawerItems = [
    { label: 'Dashboard', path: '/dashboard', icon: Dashboard },
    { label: 'Create Post', action: onCreatePost, icon: PostAdd },
    { label: 'Analytics', path: '/analytics', icon: Analytics },
    { label: 'Schedule', path: '/schedule', icon: Schedule },
    { label: 'Connections', path: '/connections', icon: LinkIcon },
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Profile', path: '/profile', icon: AccountCircle }
  ];

  const handleBottomNavChange = (_event: React.SyntheticEvent, newValue: string) => {
    HapticUtils.lightTap();
    navigate(newValue);
  };

  const handleDrawerItemClick = (item: typeof drawerItems[0]) => {
    HapticUtils.lightTap();
    
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
    
    setDrawerOpen(false);
  };

  const handleCreatePostFab = () => {
    HapticUtils.mediumTap();
    if (onCreatePost) {
      onCreatePost();
    }
  };

  if (!isMobile) {
    return null; // Use desktop navigation for non-mobile devices
  }

  return (
    <>
      {/* Top App Bar */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'rgba(26, 26, 46, 0.95)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => {
              HapticUtils.lightTap();
              setDrawerOpen(true);
            }}
          >
            <Menu />
          </IconButton>
          
          <Typography variant="h6" sx={{ flexGrow: 1, textAlign: 'center' }}>
            SMA Platform
          </Typography>
          
          <IconButton color="inherit">
            <Badge badgeContent={notificationCount} color="error">
              <Notifications />
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Side Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
            background: 'rgba(26, 26, 46, 0.98)',
            backdropFilter: 'blur(10px)',
            border: 'none'
          }
        }}
      >
        <Toolbar /> {/* Spacer for app bar */}
        
        <List>
          {drawerItems.map((item) => (
            <ListItem
              key={item.label}
              onClick={() => handleDrawerItemClick(item)}
              sx={{
                cursor: 'pointer',
                borderRadius: 2,
                mx: 1,
                mb: 0.5,
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <ListItemIcon sx={{ color: 'white' }}>
                <item.icon />
              </ListItemIcon>
              <ListItemText 
                primary={item.label}
                sx={{ color: 'white' }}
              />
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Bottom Navigation */}
      <BottomNavigation
        value={location.pathname}
        onChange={handleBottomNavChange}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'rgba(26, 26, 46, 0.95)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          '& .MuiBottomNavigationAction-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            '&.Mui-selected': {
              color: '#f093fb'
            }
          }
        }}
      >
        {bottomNavItems.map((item) => (
          <BottomNavigationAction
            key={item.value}
            label={item.label}
            value={item.value}
            icon={<item.icon />}
          />
        ))}
      </BottomNavigation>

      {/* Floating Action Button for Create Post */}
      {onCreatePost && (
        <Fab
          color="primary"
          onClick={handleCreatePostFab}
          sx={{
            position: 'fixed',
            bottom: 80, // Above bottom navigation
            right: 16,
            zIndex: (theme) => theme.zIndex.drawer + 2,
            background: 'linear-gradient(45deg, #f093fb, #f5576c)',
            '&:hover': {
              background: 'linear-gradient(45deg, #f5576c, #4facfe)',
              transform: 'scale(1.1)'
            }
          }}
        >
          <Add />
        </Fab>
      )}

      {/* Spacer for bottom navigation */}
      <Box sx={{ height: 56 }} />
    </>
  );
};

// Hook for managing mobile navigation state
export const useMobileNavigation = () => {
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const handleCreatePost = () => {
    setIsCreatePostOpen(true);
  };

  const handleCloseCreatePost = () => {
    setIsCreatePostOpen(false);
  };

  return {
    isCreatePostOpen,
    notificationCount,
    handleCreatePost,
    handleCloseCreatePost,
    setNotificationCount
  };
};