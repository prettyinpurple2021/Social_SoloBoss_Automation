import React, { useState, useEffect } from 'react';
import {
  Snackbar,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  LinearProgress
} from '@mui/material';
import { Refresh, GetApp, Wifi, WifiOff } from '@mui/icons-material';
import { PWAManager, NotificationManager, OfflineManager, PWAUpdateInfo } from '../../utils/pwa';

export const PWAUpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<PWAUpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isOffline, setIsOffline] = useState(!OfflineManager.isOnline());
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);

  useEffect(() => {
    // Initialize PWA manager
    const pwaManager = new PWAManager();
    
    // Register service worker
    pwaManager.register();
    
    // Listen for updates
    pwaManager.onUpdateAvailable((info) => {
      setUpdateInfo(info);
    });

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      
      // Show install prompt if not already installed
      if (!PWAManager.isPWA()) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for offline/online status
    OfflineManager.init();
    OfflineManager.onStatusChange(setIsOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleUpdate = async () => {
    if (!updateInfo) return;

    setIsUpdating(true);
    try {
      await updateInfo.updateServiceWorker();
    } catch (error) {
      console.error('Update failed:', error);
      setIsUpdating(false);
    }
  };

  const handleInstall = async () => {
    if (!installPromptEvent) return;

    try {
      const result = await installPromptEvent.prompt();
      console.log('Install prompt result:', result);
      
      if (result.outcome === 'accepted') {
        setShowInstallPrompt(false);
        setInstallPromptEvent(null);
        
        // Show success notification
        await NotificationManager.showNotification(
          'App Installed!',
          {
            body: 'Social Media Automation Platform has been installed successfully.',
            tag: 'install-success'
          }
        );
      }
    } catch (error) {
      console.error('Installation failed:', error);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    setInstallPromptEvent(null);
  };

  return (
    <>
      {/* Update Available Notification */}
      <Snackbar
        open={!!updateInfo && !isUpdating}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }} // Below app bar
      >
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleUpdate}
              startIcon={<Refresh />}
            >
              Update
            </Button>
          }
        >
          A new version is available!
        </Alert>
      </Snackbar>

      {/* Updating Progress */}
      <Snackbar
        open={isUpdating}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert severity="info">
          <Box sx={{ width: '100%' }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Updating app...
            </Typography>
            <LinearProgress />
          </Box>
        </Alert>
      </Snackbar>

      {/* Offline Status */}
      <Snackbar
        open={isOffline}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: 8 }} // Above bottom navigation
      >
        <Alert
          severity="warning"
          icon={<WifiOff />}
        >
          You're offline. Some features may be limited.
        </Alert>
      </Snackbar>

      {/* Online Status (brief notification) */}
      <Snackbar
        open={!isOffline && OfflineManager.isOnline()}
        autoHideDuration={2000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: 8 }}
      >
        <Alert
          severity="success"
          icon={<Wifi />}
        >
          Back online!
        </Alert>
      </Snackbar>

      {/* Install App Dialog */}
      <Dialog
        open={showInstallPrompt}
        onClose={handleDismissInstall}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GetApp />
            Install App
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Install Social Media Automation Platform for a better experience:
          </Typography>
          
          <Box component="ul" sx={{ pl: 2, mb: 2 }}>
            <li>
              <Typography variant="body2">
                Faster loading and offline access
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                Push notifications for post updates
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                Native app-like experience
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                Quick access from home screen
              </Typography>
            </li>
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            The app will be installed on your device and can be launched like any other app.
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleDismissInstall}>
            Maybe Later
          </Button>
          <Button
            onClick={handleInstall}
            variant="contained"
            startIcon={<GetApp />}
          >
            Install
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};