import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControl,
  FormControlLabel,
  Switch,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import PinterestIcon from '@mui/icons-material/Pinterest';
import TwitterIcon from '@mui/icons-material/Twitter';
import { PlatformPreferences } from '../../types/user';

interface PlatformSettingsProps {
  platformPreferences: PlatformPreferences;
  onUpdate: (preferences: Partial<PlatformPreferences>) => void;
}

export const PlatformSettings: React.FC<PlatformSettingsProps> = ({
  platformPreferences,
  onUpdate
}) => {
  const [newHashtags, setNewHashtags] = useState<Record<string, string>>({
    facebook: '',
    instagram: '',
    pinterest: '',
    x: ''
  });

  const handlePlatformUpdate = (platform: keyof PlatformPreferences, updates: any) => {
    onUpdate({
      [platform]: {
        ...platformPreferences[platform],
        ...updates
      }
    });
  };

  const handleAddHashtag = (platform: keyof PlatformPreferences) => {
    const hashtag = newHashtags[platform].trim();
    if (hashtag && !platformPreferences[platform]?.defaultHashtags?.includes(hashtag)) {
      const currentHashtags = platformPreferences[platform]?.defaultHashtags || [];
      handlePlatformUpdate(platform, {
        defaultHashtags: [...currentHashtags, hashtag]
      });
      setNewHashtags(prev => ({ ...prev, [platform]: '' }));
    }
  };

  const handleRemoveHashtag = (platform: keyof PlatformPreferences, hashtagToRemove: string) => {
    const currentHashtags = platformPreferences[platform]?.defaultHashtags || [];
    handlePlatformUpdate(platform, {
      defaultHashtags: currentHashtags.filter(tag => tag !== hashtagToRemove)
    });
  };

  const handleKeyPress = (event: React.KeyboardEvent, platform: keyof PlatformPreferences) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddHashtag(platform);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Platform-Specific Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Configure posting preferences for each social media platform
      </Typography>

      {/* Facebook Settings */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FacebookIcon color="primary" />
            <Typography variant="h6">Facebook</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={platformPreferences.facebook?.autoPost || false}
                    onChange={(e) => handlePlatformUpdate('facebook', { autoPost: e.target.checked })}
                  />
                }
                label="Auto-post to Facebook"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={platformPreferences.facebook?.includeLink || true}
                    onChange={(e) => handlePlatformUpdate('facebook', { includeLink: e.target.checked })}
                  />
                }
                label="Include links in posts"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Content Format</InputLabel>
                <Select
                  value={platformPreferences.facebook?.contentFormat || 'full'}
                  label="Content Format"
                  onChange={(e) => handlePlatformUpdate('facebook', { contentFormat: e.target.value })}
                >
                  <MenuItem value="full">Full Content</MenuItem>
                  <MenuItem value="summary">Summary Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Default Hashtags
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Add hashtag"
                value={newHashtags.facebook}
                onChange={(e) => setNewHashtags(prev => ({ ...prev, facebook: e.target.value }))}
                onKeyPress={(e) => handleKeyPress(e, 'facebook')}
                placeholder="Enter hashtag without #"
                InputProps={{
                  endAdornment: (
                    <Button
                      size="small"
                      onClick={() => handleAddHashtag('facebook')}
                      disabled={!newHashtags.facebook.trim()}
                    >
                      Add
                    </Button>
                  )
                }}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {platformPreferences.facebook?.defaultHashtags?.map((hashtag) => (
                  <Chip
                    key={hashtag}
                    label={`#${hashtag}`}
                    onDelete={() => handleRemoveHashtag('facebook', hashtag)}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Instagram Settings */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InstagramIcon sx={{ color: '#E4405F' }} />
            <Typography variant="h6">Instagram</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={platformPreferences.instagram?.autoPost || false}
                    onChange={(e) => handlePlatformUpdate('instagram', { autoPost: e.target.checked })}
                  />
                }
                label="Auto-post to Instagram"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={platformPreferences.instagram?.imageRequired || true}
                    onChange={(e) => handlePlatformUpdate('instagram', { imageRequired: e.target.checked })}
                  />
                }
                label="Require image for posts"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Hashtags"
                value={platformPreferences.instagram?.maxHashtags || 30}
                onChange={(e) => handlePlatformUpdate('instagram', { maxHashtags: parseInt(e.target.value) })}
                inputProps={{ min: 1, max: 30 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Default Hashtags
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Add hashtag"
                value={newHashtags.instagram}
                onChange={(e) => setNewHashtags(prev => ({ ...prev, instagram: e.target.value }))}
                onKeyPress={(e) => handleKeyPress(e, 'instagram')}
                placeholder="Enter hashtag without #"
                InputProps={{
                  endAdornment: (
                    <Button
                      size="small"
                      onClick={() => handleAddHashtag('instagram')}
                      disabled={!newHashtags.instagram.trim()}
                    >
                      Add
                    </Button>
                  )
                }}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {platformPreferences.instagram?.defaultHashtags?.map((hashtag) => (
                  <Chip
                    key={hashtag}
                    label={`#${hashtag}`}
                    onDelete={() => handleRemoveHashtag('instagram', hashtag)}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Pinterest Settings */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PinterestIcon sx={{ color: '#BD081C' }} />
            <Typography variant="h6">Pinterest</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={platformPreferences.pinterest?.autoPost || false}
                    onChange={(e) => handlePlatformUpdate('pinterest', { autoPost: e.target.checked })}
                  />
                }
                label="Auto-post to Pinterest"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={platformPreferences.pinterest?.imageRequired || true}
                    onChange={(e) => handlePlatformUpdate('pinterest', { imageRequired: e.target.checked })}
                  />
                }
                label="Require image for posts"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Default Board"
                value={platformPreferences.pinterest?.defaultBoard || ''}
                onChange={(e) => handlePlatformUpdate('pinterest', { defaultBoard: e.target.value })}
                placeholder="Enter board name"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Default Hashtags
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Add hashtag"
                value={newHashtags.pinterest}
                onChange={(e) => setNewHashtags(prev => ({ ...prev, pinterest: e.target.value }))}
                onKeyPress={(e) => handleKeyPress(e, 'pinterest')}
                placeholder="Enter hashtag without #"
                InputProps={{
                  endAdornment: (
                    <Button
                      size="small"
                      onClick={() => handleAddHashtag('pinterest')}
                      disabled={!newHashtags.pinterest.trim()}
                    >
                      Add
                    </Button>
                  )
                }}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {platformPreferences.pinterest?.defaultHashtags?.map((hashtag) => (
                  <Chip
                    key={hashtag}
                    label={`#${hashtag}`}
                    onDelete={() => handleRemoveHashtag('pinterest', hashtag)}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* X (Twitter) Settings */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TwitterIcon sx={{ color: '#1DA1F2' }} />
            <Typography variant="h6">X (Twitter)</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={platformPreferences.x?.autoPost || false}
                    onChange={(e) => handlePlatformUpdate('x', { autoPost: e.target.checked })}
                  />
                }
                label="Auto-post to X"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={platformPreferences.x?.shortenLinks || true}
                    onChange={(e) => handlePlatformUpdate('x', { shortenLinks: e.target.checked })}
                  />
                }
                label="Automatically shorten links"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={platformPreferences.x?.threadLongContent || true}
                    onChange={(e) => handlePlatformUpdate('x', { threadLongContent: e.target.checked })}
                  />
                }
                label="Create threads for long content"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Default Hashtags
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Add hashtag"
                value={newHashtags.x}
                onChange={(e) => setNewHashtags(prev => ({ ...prev, x: e.target.value }))}
                onKeyPress={(e) => handleKeyPress(e, 'x')}
                placeholder="Enter hashtag without #"
                InputProps={{
                  endAdornment: (
                    <Button
                      size="small"
                      onClick={() => handleAddHashtag('x')}
                      disabled={!newHashtags.x.trim()}
                    >
                      Add
                    </Button>
                  )
                }}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {platformPreferences.x?.defaultHashtags?.map((hashtag) => (
                  <Chip
                    key={hashtag}
                    label={`#${hashtag}`}
                    onDelete={() => handleRemoveHashtag('x', hashtag)}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};