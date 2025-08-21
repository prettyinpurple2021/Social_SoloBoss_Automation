import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Grid,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { UserSettings } from '../../types/user';

interface GeneralSettingsProps {
  settings: UserSettings;
  onUpdate: (settings: Partial<UserSettings>) => void;
  onReset: () => void;
}

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
];

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  settings,
  onUpdate,
  onReset
}) => {
  const [timezone, setTimezone] = useState(settings.timezone || 'UTC');
  const [defaultHashtags, setDefaultHashtags] = useState<string[]>(settings.defaultHashtags || []);
  const [newHashtag, setNewHashtag] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const handleTimezoneChange = (newTimezone: string) => {
    setTimezone(newTimezone);
    onUpdate({ timezone: newTimezone });
  };

  const handleAddHashtag = () => {
    if (newHashtag.trim() && !defaultHashtags.includes(newHashtag.trim())) {
      const updatedHashtags = [...defaultHashtags, newHashtag.trim()];
      setDefaultHashtags(updatedHashtags);
      setNewHashtag('');
      onUpdate({ defaultHashtags: updatedHashtags });
    }
  };

  const handleRemoveHashtag = (hashtagToRemove: string) => {
    const updatedHashtags = defaultHashtags.filter(tag => tag !== hashtagToRemove);
    setDefaultHashtags(updatedHashtags);
    onUpdate({ defaultHashtags: updatedHashtags });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddHashtag();
    }
  };

  const handleResetConfirm = () => {
    onReset();
    setResetDialogOpen(false);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        General Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Timezone
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Timezone</InputLabel>
              <Select
                value={timezone}
                label="Timezone"
                onChange={(e) => handleTimezoneChange(e.target.value)}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <MenuItem key={tz} value={tz}>
                    {tz}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Default Hashtags
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              These hashtags will be automatically added to new posts
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="Add hashtag"
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter hashtag without #"
                InputProps={{
                  endAdornment: (
                    <Button
                      size="small"
                      onClick={handleAddHashtag}
                      disabled={!newHashtag.trim()}
                    >
                      Add
                    </Button>
                  )
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {defaultHashtags.map((hashtag) => (
                <Chip
                  key={hashtag}
                  label={`#${hashtag}`}
                  onDelete={() => handleRemoveHashtag(hashtag)}
                  color="primary"
                  variant="outlined"
                />
              ))}
              {defaultHashtags.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No default hashtags set
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setResetDialogOpen(true)}
            >
              Reset to Defaults
            </Button>
          </Box>
        </Grid>
      </Grid>

      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
      >
        <DialogTitle>Reset Settings</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to reset all settings to their default values? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleResetConfirm} color="error" variant="contained">
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};