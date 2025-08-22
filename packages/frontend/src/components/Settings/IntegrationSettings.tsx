import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControlLabel,
  Switch,
  Alert,
  Button,
  Divider
} from '@mui/material';
import { UserSettings } from '../../types/user';

interface IntegrationSettingsProps {
  settings: UserSettings;
  onUpdate: (settings: Partial<UserSettings>) => void;
}

export const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({
  settings,
  onUpdate
}) => {
  const handleBloggerToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ bloggerIntegrationEnabled: event.target.checked });
  };

  const handleSoloBossAutoApproveToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ autoApproveFromSoloBoss: event.target.checked });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Integration Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Configure integrations with external services
      </Typography>

      <Grid container spacing={3}>
        {/* Blogger Integration */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Blogger Integration
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.bloggerIntegrationEnabled || false}
                  onChange={handleBloggerToggle}
                />
              }
              label="Enable Blogger integration"
            />
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              Automatically detect new blog posts and create social media posts
            </Typography>

            {settings.bloggerIntegrationEnabled && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>How it works:</strong>
                  <br />
                  • We monitor your Blogger feed for new posts every 5 minutes
                  <br />
                  • When a new post is detected, we generate social media posts with a summary and link
                  <br />
                  • You'll be able to review and edit the generated posts before they're scheduled
                  <br />
                  • If you don't approve within 24 hours, you'll receive a reminder notification
                </Typography>
              </Alert>
            )}

            {settings.bloggerIntegrationEnabled && (
              <Box sx={{ mt: 2 }}>
                <Button variant="outlined" size="small">
                  Configure Blogger Connection
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                  Set up your Blogger feed URL and authentication
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* SoloBoss AI Content Planner Integration */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              SoloBoss AI Content Planner Integration
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Seamlessly import content from SoloBoss AI Content Planner
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoApproveFromSoloBoss || false}
                  onChange={handleSoloBossAutoApproveToggle}
                />
              }
              label="Auto-approve posts from SoloBoss"
            />
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              Automatically schedule posts without manual review when they come from SoloBoss
            </Typography>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>How it works:</strong>
                <br />
                • SoloBoss sends finalized blog posts with content, SEO suggestions, and images
                <br />
                • Posts are automatically formatted for each social media platform
                <br />
                • {settings.autoApproveFromSoloBoss 
                    ? 'Posts will be automatically scheduled based on your platform preferences'
                    : 'You\'ll review and customize each post before scheduling'
                }
              </Typography>
            </Alert>

            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" size="small">
                Configure SoloBoss Connection
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                Set up API key or OAuth connection
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Integration Status */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
            <Typography variant="h6" gutterBottom>
              Integration Status
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: settings.bloggerIntegrationEnabled ? 'success.main' : 'grey.400'
                    }}
                  />
                  <Typography variant="body2">
                    Blogger: {settings.bloggerIntegrationEnabled ? 'Enabled' : 'Disabled'}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: 'grey.400' // Would be dynamic based on actual connection status
                    }}
                  />
                  <Typography variant="body2">
                    SoloBoss: Not Connected
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};