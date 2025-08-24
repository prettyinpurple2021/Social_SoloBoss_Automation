import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControlLabel,
  Switch,
  TextField,
  Chip,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Divider,
  Alert
} from '@mui/material';
import {
  Facebook,
  Instagram,
  Pinterest,
  X as XIcon,
  Add,
  Delete
} from '@mui/icons-material';
import { Platform } from '@sma/shared/types/platform';
import { PLATFORM_COLORS, PLATFORM_NAMES } from '@sma/shared/constants/platforms';
import { PlatformPreferences } from '../../types/user';

interface PlatformSettingsProps {
  platformPreferences: PlatformPreferences;
  onUpdate: (preferences: Partial<PlatformPreferences>) => void;
}

const platformIcons = {
  [Platform.FACEBOOK]: <Facebook />,
  [Platform.INSTAGRAM]: <Instagram />,
  [Platform.PINTEREST]: <Pinterest />,
  [Platform.X]: <XIcon />
};

export const PlatformSettings: React.FC<PlatformSettingsProps> = ({
  platformPreferences,
  onUpdate
}) => {
  const [newHashtags, setNewHashtags] = useState<Record<Platform, string>>({
    [Platform.FACEBOOK]: '',
    [Platform.INSTAGRAM]: '',
    [Platform.PINTEREST]: '',
    [Platform.X]: ''
  });

  const handlePlatformUpdate = (platform: Platform, updates: any) => {
    onUpdate({
      [platform]: {
        ...platformPreferences[platform],
        ...updates
      }
    });
  };

  const handleAddHashtag = (platform: Platform) => {
    const hashtag = newHashtags[platform].trim();
    if (hashtag && !platformPreferences[platform].defaultHashtags.includes(hashtag)) {
      const formattedHashtag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
      handlePlatformUpdate(platform, {
        defaultHashtags: [...platformPreferences[platform].defaultHashtags, formattedHashtag]
      });
      setNewHashtags(prev => ({ ...prev, [platform]: '' }));
    }
  };

  const handleRemoveHashtag = (platform: Platform, hashtagToRemove: string) => {
    handlePlatformUpdate(platform, {
      defaultHashtags: platformPreferences[platform].defaultHashtags.filter(
        tag => tag !== hashtagToRemove
      )
    });
  };

  const handleHashtagKeyPress = (platform: Platform, event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddHashtag(platform);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Platform Preferences
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Customize settings for each social media platform
      </Typography>

      <Grid container spacing={3}>
        {/* Facebook Settings */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar
                sx={{
                  bgcolor: PLATFORM_COLORS[Platform.FACEBOOK],
                  mr: 2,
                  width: 40,
                  height: 40
                }}
              >
                {platformIcons[Platform.FACEBOOK]}
              </Avatar>
              <Typography variant="h6">
                {PLATFORM_NAMES[Platform.FACEBOOK]}
              </Typography>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Content Format</InputLabel>
                  <Select
                    value={platformPreferences.facebook.contentFormat}
                    label="Content Format"
                    onChange={(e) => handlePlatformUpdate(Platform.FACEBOOK, {
                      contentFormat: e.target.value
                    })}
                  >
                    <MenuItem value="full">Full Content</MenuItem>
                    <MenuItem value="summary">Summary with Link</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={platformPreferences.facebook.includeLink}
                        onChange={(e) => handlePlatformUpdate(Platform.FACEBOOK, {
                          includeLink: e.target.checked
                        })}
                      />
                    }
                    label="Include link to original content"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={platformPreferences.facebook.autoPost}
                        onChange={(e) => handlePlatformUpdate(Platform.FACEBOOK, {
                          autoPost: e.target.checked
                        })}
                      />
                    }
                    label="Auto-post without review"
                  />
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Default Hashtags
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {platformPreferences.facebook.defaultHashtags.map((hashtag) => (
                    <Chip
                      key={hashtag}
                      label={hashtag}
                      onDelete={() => handleRemoveHashtag(Platform.FACEBOOK, hashtag)}
                      deleteIcon={<Delete />}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Add hashtag"
                    value={newHashtags[Platform.FACEBOOK]}
                    onChange={(e) => setNewHashtags(prev => ({
                      ...prev,
                      [Platform.FACEBOOK]: e.target.value
                    }))}
                    onKeyPress={(e) => handleHashtagKeyPress(Platform.FACEBOOK, e)}
                    sx={{ flexGrow: 1 }}
                  />
                  <Button
                    startIcon={<Add />}
                    onClick={() => handleAddHashtag(Platform.FACEBOOK)}
                    disabled={!newHashtags[Platform.FACEBOOK].trim()}
                  >
                    Add
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Instagram Settings */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar
                sx={{
                  bgcolor: PLATFORM_COLORS[Platform.INSTAGRAM],
                  mr: 2,
                  width: 40,
                  height: 40
                }}
              >
                {platformIcons[Platform.INSTAGRAM]}
              </Avatar>
              <Typography variant="h6">
                {PLATFORM_NAMES[Platform.INSTAGRAM]}
              </Typography>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Maximum Hashtags"
                  value={platformPreferences.instagram.maxHashtags}
                  onChange={(e) => handlePlatformUpdate(Platform.INSTAGRAM, {
                    maxHashtags: parseInt(e.target.value) || 30
                  })}
                  inputProps={{ min: 1, max: 30 }}
                  helperText="Instagram allows up to 30 hashtags per post"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={platformPreferences.instagram.imageRequired}
                        onChange={(e) => handlePlatformUpdate(Platform.INSTAGRAM, {
                          imageRequired: e.target.checked
                        })}
                      />
                    }
                    label="Require image for posts"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={platformPreferences.instagram.autoPost}
                        onChange={(e) => handlePlatformUpdate(Platform.INSTAGRAM, {
                          autoPost: e.target.checked
                        })}
                      />
                    }
                    label="Auto-post without review"
                  />
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Default Hashtags
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {platformPreferences.instagram.defaultHashtags.map((hashtag) => (
                    <Chip
                      key={hashtag}
                      label={hashtag}
                      onDelete={() => handleRemoveHashtag(Platform.INSTAGRAM, hashtag)}
                      deleteIcon={<Delete />}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Add hashtag"
                    value={newHashtags[Platform.INSTAGRAM]}
                    onChange={(e) => setNewHashtags(prev => ({
                      ...prev,
                      [Platform.INSTAGRAM]: e.target.value
                    }))}
                    onKeyPress={(e) => handleHashtagKeyPress(Platform.INSTAGRAM, e)}
                    sx={{ flexGrow: 1 }}
                  />
                  <Button
                    startIcon={<Add />}
                    onClick={() => handleAddHashtag(Platform.INSTAGRAM)}
                    disabled={!newHashtags[Platform.INSTAGRAM].trim()}
                  >
                    Add
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Pinterest Settings */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar
                sx={{
                  bgcolor: PLATFORM_COLORS[Platform.PINTEREST],
                  mr: 2,
                  width: 40,
                  height: 40
                }}
              >
                {platformIcons[Platform.PINTEREST]}
              </Avatar>
              <Typography variant="h6">
                {PLATFORM_NAMES[Platform.PINTEREST]}
              </Typography>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Default Board"
                  value={platformPreferences.pinterest.defaultBoard}
                  onChange={(e) => handlePlatformUpdate(Platform.PINTEREST, {
                    defaultBoard: e.target.value
                  })}
                  helperText="Board name where pins will be saved"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={platformPreferences.pinterest.imageRequired}
                        onChange={(e) => handlePlatformUpdate(Platform.PINTEREST, {
                          imageRequired: e.target.checked
                        })}
                      />
                    }
                    label="Require image for pins"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={platformPreferences.pinterest.autoPost}
                        onChange={(e) => handlePlatformUpdate(Platform.PINTEREST, {
                          autoPost: e.target.checked
                        })}
                      />
                    }
                    label="Auto-post without review"
                  />
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Default Hashtags
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {platformPreferences.pinterest.defaultHashtags.map((hashtag) => (
                    <Chip
                      key={hashtag}
                      label={hashtag}
                      onDelete={() => handleRemoveHashtag(Platform.PINTEREST, hashtag)}
                      deleteIcon={<Delete />}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Add hashtag"
                    value={newHashtags[Platform.PINTEREST]}
                    onChange={(e) => setNewHashtags(prev => ({
                      ...prev,
                      [Platform.PINTEREST]: e.target.value
                    }))}
                    onKeyPress={(e) => handleHashtagKeyPress(Platform.PINTEREST, e)}
                    sx={{ flexGrow: 1 }}
                  />
                  <Button
                    startIcon={<Add />}
                    onClick={() => handleAddHashtag(Platform.PINTEREST)}
                    disabled={!newHashtags[Platform.PINTEREST].trim()}
                  >
                    Add
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* X (Twitter) Settings */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar
                sx={{
                  bgcolor: PLATFORM_COLORS[Platform.X],
                  mr: 2,
                  width: 40,
                  height: 40
                }}
              >
                {platformIcons[Platform.X]}
              </Avatar>
              <Typography variant="h6">
                {PLATFORM_NAMES[Platform.X]}
              </Typography>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={platformPreferences.x.shortenLinks}
                        onChange={(e) => handlePlatformUpdate(Platform.X, {
                          shortenLinks: e.target.checked
                        })}
                      />
                    }
                    label="Automatically shorten links"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={platformPreferences.x.threadLongContent}
                        onChange={(e) => handlePlatformUpdate(Platform.X, {
                          threadLongContent: e.target.checked
                        })}
                      />
                    }
                    label="Create threads for long content"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={platformPreferences.x.autoPost}
                        onChange={(e) => handlePlatformUpdate(Platform.X, {
                          autoPost: e.target.checked
                        })}
                      />
                    }
                    label="Auto-post without review"
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    X has a 280 character limit. Long content will be automatically split into threads if enabled.
                  </Typography>
                </Alert>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Default Hashtags
                </Typography>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Recommended: Use 1-2 hashtags maximum for X posts
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {platformPreferences.x.defaultHashtags.map((hashtag) => (
                    <Chip
                      key={hashtag}
                      label={hashtag}
                      onDelete={() => handleRemoveHashtag(Platform.X, hashtag)}
                      deleteIcon={<Delete />}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Add hashtag"
                    value={newHashtags[Platform.X]}
                    onChange={(e) => setNewHashtags(prev => ({
                      ...prev,
                      [Platform.X]: e.target.value
                    }))}
                    onKeyPress={(e) => handleHashtagKeyPress(Platform.X, e)}
                    sx={{ flexGrow: 1 }}
                  />
                  <Button
                    startIcon={<Add />}
                    onClick={() => handleAddHashtag(Platform.X)}
                    disabled={!newHashtags[Platform.X].trim()}
                  >
                    Add
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};