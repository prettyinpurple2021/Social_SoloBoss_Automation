import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControlLabel,
  Switch,
  TextField,
  Alert
} from '@mui/material';
import { NotificationSettings as NotificationSettingsType } from '../../types/user';

interface NotificationSettingsProps {
  notificationSettings: NotificationSettingsType;
  onUpdate: (settings: Partial<NotificationSettingsType>) => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  notificationSettings,
  onUpdate
}) => {
  const [notificationEmail, setNotificationEmail] = useState(
    notificationSettings.notificationEmail || ''
  );

  const handleToggle = (setting: keyof NotificationSettingsType) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onUpdate({ [setting]: event.target.checked });
  };

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const email = event.target.value;
    setNotificationEmail(email);
    onUpdate({ notificationEmail: email });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Notification Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Configure how and when you receive notifications about your social media posts
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Email Notifications
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.emailNotifications || false}
                    onChange={handleToggle('emailNotifications')}
                  />
                }
                label="Enable email notifications"
              />
            </Box>

            {notificationSettings.emailNotifications && (
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  type="email"
                  label="Notification Email"
                  value={notificationEmail}
                  onChange={handleEmailChange}
                  placeholder="Enter email address for notifications"
                  helperText="Leave empty to use your account email"
                />
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Post Notifications
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.failedPostNotifications || false}
                    onChange={handleToggle('failedPostNotifications')}
                    disabled={!notificationSettings.emailNotifications}
                  />
                }
                label="Failed post notifications"
              />
              
              <Typography variant="body2" color="text.secondary">
                Get notified when a scheduled post fails to publish
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Integration Notifications
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.integrationIssueNotifications || false}
                    onChange={handleToggle('integrationIssueNotifications')}
                    disabled={!notificationSettings.emailNotifications}
                  />
                }
                label="Integration issue notifications"
              />
              
              <Typography variant="body2" color="text.secondary">
                Get notified about issues with Blogger or SoloBoss integrations
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Reports
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.weeklyReports || false}
                    onChange={handleToggle('weeklyReports')}
                    disabled={!notificationSettings.emailNotifications}
                  />
                }
                label="Weekly reports"
              />
              
              <Typography variant="body2" color="text.secondary">
                Receive a weekly summary of your posting activity and performance
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {!notificationSettings.emailNotifications && (
          <Grid item xs={12}>
            <Alert severity="info">
              Enable email notifications to configure specific notification types
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};