import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Switch,
  TextField,
  Button,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Email,
  Error,
  Warning,
  Assessment,
  Schedule,
  CheckCircle
} from '@mui/icons-material';
import { NotificationSettings as NotificationSettingsType } from '../../types/user';

interface NotificationSettingsProps {
  notificationSettings: NotificationSettingsType;
  onUpdate: (settings: Partial<NotificationSettingsType>) => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  notificationSettings,
  onUpdate
}) => {
  const [testEmailSent, setTestEmailSent] = useState(false);

  const handleToggle = (setting: keyof NotificationSettingsType) => {
    onUpdate({
      [setting]: !notificationSettings[setting]
    });
  };

  const handleEmailChange = (email: string) => {
    onUpdate({
      notificationEmail: email
    });
  };

  const sendTestEmail = async () => {
    // Mock sending test email
    setTestEmailSent(true);
    setTimeout(() => setTestEmailSent(false), 3000);
  };

  const notificationTypes = [
    {
      key: 'emailNotifications' as keyof NotificationSettingsType,
      icon: <Email />,
      title: 'Email Notifications',
      description: 'Receive email notifications for important events',
      enabled: notificationSettings.emailNotifications
    },
    {
      key: 'failedPostNotifications' as keyof NotificationSettingsType,
      icon: <Error />,
      title: 'Failed Post Notifications',
      description: 'Get notified when posts fail to publish',
      enabled: notificationSettings.failedPostNotifications
    },
    {
      key: 'integrationIssueNotifications' as keyof NotificationSettingsType,
      icon: <Warning />,
      title: 'Integration Issues',
      description: 'Alerts for Blogger and SoloBoss integration problems',
      enabled: notificationSettings.integrationIssueNotifications
    },
    {
      key: 'weeklyReports' as keyof NotificationSettingsType,
      icon: <Assessment />,
      title: 'Weekly Reports',
      description: 'Receive weekly analytics and performance summaries',
      enabled: notificationSettings.weeklyReports
    }
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Notification Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Configure how and when you receive notifications
      </Typography>

      <Grid container spacing={3}>
        {/* Email Configuration */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Email Configuration
            </Typography>
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Notification Email"
                  type="email"
                  value={notificationSettings.notificationEmail || ''}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="Enter email address for notifications"
                  helperText="Leave empty to use your account email"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  variant="outlined"
                  onClick={sendTestEmail}
                  disabled={!notificationSettings.emailNotifications}
                  fullWidth
                >
                  Send Test Email
                </Button>
              </Grid>
            </Grid>

            {testEmailSent && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Test email sent successfully! Check your inbox.
              </Alert>
            )}

            {!notificationSettings.emailNotifications && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Enable email notifications to receive alerts and reports.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Notification Types */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Notification Types
            </Typography>
            
            <List>
              {notificationTypes.map((notification, index) => (
                <React.Fragment key={notification.key}>
                  <ListItem>
                    <ListItemIcon>
                      {notification.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={notification.title}
                      secondary={notification.description}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={notification.enabled}
                        onChange={() => handleToggle(notification.key)}
                        color="primary"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < notificationTypes.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Notification Examples */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              What You'll Receive
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <CheckCircle color="success" fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Successful Posts
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Confirmation when posts are successfully published to all platforms
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <Error color="error" fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Failed Posts
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Immediate alerts when posts fail with retry options and error details
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <Schedule color="info" fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Scheduled Reminders
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Reminders about upcoming scheduled posts and content reviews
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <Assessment color="primary" fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Performance Reports
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Weekly summaries of your social media performance and engagement
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Notification Frequency */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Notification Frequency
            </Typography>
            
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Immediate:</strong> Failed posts, integration issues, and critical errors
                <br />
                <strong>Daily:</strong> Summary of successful posts and pending reviews
                <br />
                <strong>Weekly:</strong> Performance reports and analytics summaries
              </Typography>
            </Alert>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};