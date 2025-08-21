import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';
import { GeneralSettings } from './GeneralSettings';
import { PlatformSettings } from './PlatformSettings';
import { NotificationSettings } from './NotificationSettings';
import { IntegrationSettings } from './IntegrationSettings';
import { UserSettings } from '../../types/user';
import { settingsApi } from '../../services/settingsApi';

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
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

export const Settings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await settingsApi.getSettings();
      if (response.success) {
        setSettings(response.settings);
      } else {
        setError(response.error || 'Failed to load settings');
      }
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSettingsUpdate = async (updatedSettings: Partial<UserSettings>) => {
    try {
      setError(null);
      setSuccess(null);
      const response = await settingsApi.updateSettings(updatedSettings);
      if (response.success) {
        setSettings(response.settings);
        setSuccess('Settings updated successfully');
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to update settings');
      }
    } catch (err) {
      setError('Failed to update settings');
    }
  };

  const handlePlatformPreferencesUpdate = async (platformPreferences: any) => {
    try {
      setError(null);
      setSuccess(null);
      const response = await settingsApi.updatePlatformPreferences(platformPreferences);
      if (response.success) {
        setSettings(response.settings);
        setSuccess('Platform preferences updated successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to update platform preferences');
      }
    } catch (err) {
      setError('Failed to update platform preferences');
    }
  };

  const handleNotificationSettingsUpdate = async (notificationSettings: any) => {
    try {
      setError(null);
      setSuccess(null);
      const response = await settingsApi.updateNotificationSettings(notificationSettings);
      if (response.success) {
        setSettings(response.settings);
        setSuccess('Notification settings updated successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to update notification settings');
      }
    } catch (err) {
      setError('Failed to update notification settings');
    }
  };

  const handleResetSettings = async () => {
    try {
      setError(null);
      setSuccess(null);
      const response = await settingsApi.resetSettings();
      if (response.success) {
        setSettings(response.settings);
        setSuccess('Settings reset to defaults successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || 'Failed to reset settings');
      }
    } catch (err) {
      setError('Failed to reset settings');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!settings) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">Failed to load settings</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
            <Tab label="General" {...a11yProps(0)} />
            <Tab label="Platform Preferences" {...a11yProps(1)} />
            <Tab label="Notifications" {...a11yProps(2)} />
            <Tab label="Integrations" {...a11yProps(3)} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <GeneralSettings
            settings={settings}
            onUpdate={handleSettingsUpdate}
            onReset={handleResetSettings}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <PlatformSettings
            platformPreferences={settings.platformPreferences}
            onUpdate={handlePlatformPreferencesUpdate}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <NotificationSettings
            notificationSettings={settings.notificationSettings}
            onUpdate={handleNotificationSettingsUpdate}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <IntegrationSettings
            settings={settings}
            onUpdate={handleSettingsUpdate}
          />
        </TabPanel>
      </Paper>
    </Container>
  );
};