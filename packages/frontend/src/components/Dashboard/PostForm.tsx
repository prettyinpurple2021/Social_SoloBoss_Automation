import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Chip,
  IconButton,
  Stack,
  Avatar,
  Alert,
  Divider,
  Grid
} from '@mui/material';
import {
  Facebook,
  Instagram,
  Pinterest,
  X as XIcon,
  Add,
  Delete,
  Schedule,
  Send
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Platform } from '@sma/shared/types/platform';
import { PostData } from '@sma/shared/types/post';
import { PLATFORM_NAMES, PLATFORM_COLORS, PLATFORM_CHARACTER_LIMITS } from '@sma/shared/constants/platforms';
import dayjs, { Dayjs } from 'dayjs';

interface PostFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (postData: PostData) => void;
  initialData?: Partial<PostData>;
}

const platformIcons = {
  [Platform.FACEBOOK]: <Facebook />,
  [Platform.INSTAGRAM]: <Instagram />,
  [Platform.PINTEREST]: <Pinterest />,
  [Platform.X]: <XIcon />
};

export const PostForm: React.FC<PostFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialData
}) => {
  const [content, setContent] = useState(initialData?.content || '');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(
    initialData?.platforms || []
  );
  const [hashtags, setHashtags] = useState<string[]>(initialData?.hashtags || []);
  const [newHashtag, setNewHashtag] = useState('');
  const [scheduledTime, setScheduledTime] = useState<Dayjs | null>(
    initialData?.scheduledTime ? dayjs(initialData.scheduledTime) : null
  );
  const [isScheduled, setIsScheduled] = useState(Boolean(initialData?.scheduledTime));

  const handlePlatformToggle = (platform: Platform) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleAddHashtag = () => {
    if (newHashtag.trim() && !hashtags.includes(newHashtag.trim())) {
      const formattedHashtag = newHashtag.trim().startsWith('#') 
        ? newHashtag.trim() 
        : `#${newHashtag.trim()}`;
      setHashtags(prev => [...prev, formattedHashtag]);
      setNewHashtag('');
    }
  };

  const handleRemoveHashtag = (hashtagToRemove: string) => {
    setHashtags(prev => prev.filter(tag => tag !== hashtagToRemove));
  };

  const handleSubmit = () => {
    const postData: PostData = {
      userId: 'current-user', // This would come from auth context
      platforms: selectedPlatforms,
      content: content.trim(),
      hashtags,
      scheduledTime: isScheduled && scheduledTime ? scheduledTime.toDate() : undefined
    };

    onSubmit(postData);
    handleReset();
  };

  const handleReset = () => {
    setContent('');
    setSelectedPlatforms([]);
    setHashtags([]);
    setNewHashtag('');
    setScheduledTime(null);
    setIsScheduled(false);
  };

  const getCharacterCount = (platform: Platform) => {
    const fullContent = `${content} ${hashtags.join(' ')}`.trim();
    return {
      current: fullContent.length,
      limit: PLATFORM_CHARACTER_LIMITS[platform]
    };
  };

  const isFormValid = () => {
    return (
      content.trim().length > 0 &&
      selectedPlatforms.length > 0 &&
      (!isScheduled || scheduledTime) &&
      selectedPlatforms.every(platform => {
        const { current, limit } = getCharacterCount(platform);
        return current <= limit;
      })
    );
  };

  const hasCharacterLimitWarning = () => {
    return selectedPlatforms.some(platform => {
      const { current, limit } = getCharacterCount(platform);
      return current > limit * 0.9; // Warning at 90% of limit
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '70vh' }
        }}
      >
        <DialogTitle>
          {initialData ? 'Edit Post' : 'Create New Post'}
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            {/* Content Input */}
            <TextField
              label="Post Content"
              multiline
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What would you like to share?"
              fullWidth
              variant="outlined"
            />

            {/* Platform Selection */}
            <FormControl component="fieldset">
              <FormLabel component="legend">Select Platforms</FormLabel>
              <FormGroup>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {Object.values(Platform).map((platform) => {
                    const isSelected = selectedPlatforms.includes(platform);
                    const { current, limit } = getCharacterCount(platform);
                    const isOverLimit = current > limit;
                    
                    return (
                      <Grid item xs={12} sm={6} key={platform}>
                        <Box
                          sx={{
                            border: 1,
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            borderRadius: 1,
                            p: 2,
                            cursor: 'pointer',
                            bgcolor: isSelected ? 'primary.50' : 'transparent',
                            '&:hover': { bgcolor: isSelected ? 'primary.100' : 'action.hover' }
                          }}
                          onClick={() => handlePlatformToggle(platform)}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={isSelected}
                                onChange={() => handlePlatformToggle(platform)}
                                color="primary"
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    bgcolor: PLATFORM_COLORS[platform],
                                    '& .MuiSvgIcon-root': { fontSize: 16 }
                                  }}
                                >
                                  {platformIcons[platform]}
                                </Avatar>
                                <Typography variant="body2">
                                  {PLATFORM_NAMES[platform]}
                                </Typography>
                              </Box>
                            }
                            sx={{ m: 0, width: '100%' }}
                          />
                          {isSelected && (
                            <Typography 
                              variant="caption" 
                              color={isOverLimit ? 'error' : 'text.secondary'}
                              sx={{ ml: 4, display: 'block' }}
                            >
                              {current}/{limit} characters
                            </Typography>
                          )}
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </FormGroup>
            </FormControl>

            {/* Character Limit Warning */}
            {hasCharacterLimitWarning() && (
              <Alert severity="warning">
                Some platforms are approaching or exceeding character limits. Consider shortening your content.
              </Alert>
            )}

            {/* Hashtags */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Hashtags
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {hashtags.map((hashtag) => (
                  <Chip
                    key={hashtag}
                    label={hashtag}
                    onDelete={() => handleRemoveHashtag(hashtag)}
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
                  value={newHashtag}
                  onChange={(e) => setNewHashtag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddHashtag();
                    }
                  }}
                  sx={{ flexGrow: 1 }}
                />
                <IconButton onClick={handleAddHashtag} color="primary">
                  <Add />
                </IconButton>
              </Box>
            </Box>

            <Divider />

            {/* Scheduling */}
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                  />
                }
                label="Schedule for later"
              />
              
              {isScheduled && (
                <Box sx={{ mt: 2 }}>
                  <DateTimePicker
                    label="Scheduled Time"
                    value={scheduledTime}
                    onChange={(newValue) => setScheduledTime(newValue)}
                    minDateTime={dayjs().add(5, 'minute')}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        variant: 'outlined'
                      }
                    }}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!isFormValid()}
            startIcon={isScheduled ? <Schedule /> : <Send />}
          >
            {isScheduled ? 'Schedule Post' : 'Post Now'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};