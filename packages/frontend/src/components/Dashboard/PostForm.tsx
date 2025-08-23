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
  Send,
  AutoAwesome
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
          sx: { 
            minHeight: '70vh',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '25px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
          }
        }}
      >
        <DialogTitle sx={{ 
          textAlign: 'center',
          pb: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
            <AutoAwesome sx={{ 
              mr: 1,
              fontSize: '1.5rem',
              background: 'linear-gradient(45deg, #f093fb, #f5576c)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }} />
            <Typography 
              variant="h4"
              sx={{
                fontFamily: '"Kalnia Glaze", serif',
                background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 500
              }}
            >
              {initialData ? 'Edit Post' : 'Create New Post'}
            </Typography>
          </Box>
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '15px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  fontFamily: '"Kalnia Glaze", serif',
                  fontSize: '1.1rem',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.9)',
                  },
                  '&.Mui-focused': {
                    background: 'rgba(255, 255, 255, 0.95)',
                  },
                },
                '& .MuiInputLabel-root': {
                  fontFamily: '"Kalnia Glaze", serif',
                  fontWeight: 500
                }
              }}
            />

            {/* Platform Selection */}
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ 
                fontFamily: '"Kalnia Glaze", serif',
                fontSize: '1.2rem',
                fontWeight: 500,
                color: 'text.primary'
              }}>
                Select Platforms
              </FormLabel>
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
                            border: 2,
                            borderColor: isSelected ? 'primary.main' : 'rgba(255, 255, 255, 0.3)',
                            borderRadius: '15px',
                            p: 2,
                            cursor: 'pointer',
                            background: isSelected 
                              ? 'linear-gradient(45deg, rgba(240, 147, 251, 0.1), rgba(79, 172, 254, 0.1))'
                              : 'rgba(255, 255, 255, 0.5)',
                            backdropFilter: 'blur(10px)',
                            transition: 'all 0.3s ease',
                            '&:hover': { 
                              background: isSelected 
                                ? 'linear-gradient(45deg, rgba(240, 147, 251, 0.2), rgba(79, 172, 254, 0.2))'
                                : 'rgba(255, 255, 255, 0.7)',
                              transform: 'translateY(-2px)',
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)'
                            }
                          }}
                          onClick={() => handlePlatformToggle(platform)}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={isSelected}
                                onChange={() => handlePlatformToggle(platform)}
                                color="primary"
                                sx={{
                                  '&.Mui-checked': {
                                    color: 'primary.main',
                                  }
                                }}
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    bgcolor: PLATFORM_COLORS[platform],
                                    '& .MuiSvgIcon-root': { fontSize: 18 },
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                                  }}
                                >
                                  {platformIcons[platform]}
                                </Avatar>
                                <Typography 
                                  variant="body2"
                                  sx={{ 
                                    fontFamily: '"Kalnia Glaze", serif',
                                    fontWeight: 500
                                  }}
                                >
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
                              sx={{ 
                                ml: 4, 
                                display: 'block',
                                fontFamily: '"Kalnia Glaze", serif',
                                fontWeight: 500
                              }}
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
              <Alert severity="warning" sx={{ 
                borderRadius: '15px',
                fontFamily: '"Kalnia Glaze", serif',
                fontWeight: 500
              }}>
                Some platforms are approaching or exceeding character limits. Consider shortening your content.
              </Alert>
            )}

            {/* Hashtags */}
            <Box>
              <Typography 
                variant="h6" 
                gutterBottom
                sx={{ 
                  fontFamily: '"Kalnia Glaze", serif',
                  fontWeight: 500,
                  color: 'text.primary'
                }}
              >
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
                    sx={{
                      fontFamily: '"Kalnia Glaze", serif',
                      fontWeight: 500,
                      borderRadius: '12px',
                      border: '1px solid',
                      borderImage: 'linear-gradient(45deg, #f093fb, #f5576c) 1',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                        color: 'white',
                      }
                    }}
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
                  sx={{ 
                    flexGrow: 1,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(10px)',
                      fontFamily: '"Kalnia Glaze", serif',
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.9)',
                      },
                      '&.Mui-focused': {
                        background: 'rgba(255, 255, 255, 0.95)',
                      },
                    }
                  }}
                />
                <IconButton 
                  onClick={handleAddHashtag} 
                  sx={{
                    background: 'linear-gradient(45deg, #4facfe, #00f2fe)',
                    color: 'white',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #00f2fe, #4facfe)',
                      transform: 'scale(1.1)',
                    }
                  }}
                >
                  <Add />
                </IconButton>
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.2)' }} />

            {/* Scheduling */}
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    sx={{
                      '&.Mui-checked': {
                        color: 'primary.main',
                      }
                    }}
                  />
                }
                label={
                  <Typography sx={{ 
                    fontFamily: '"Kalnia Glaze", serif',
                    fontWeight: 500,
                    fontSize: '1.1rem'
                  }}>
                    Schedule for later
                  </Typography>
                }
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
                        variant: 'outlined',
                        sx: {
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '15px',
                            background: 'rgba(255, 255, 255, 0.8)',
                            backdropFilter: 'blur(10px)',
                            fontFamily: '"Kalnia Glaze", serif',
                            '&:hover': {
                              background: 'rgba(255, 255, 255, 0.9)',
                            },
                            '&.Mui-focused': {
                              background: 'rgba(255, 255, 255, 0.95)',
                            },
                          },
                          '& .MuiInputLabel-root': {
                            fontFamily: '"Kalnia Glaze", serif',
                            fontWeight: 500
                          }
                        }
                      }
                    }}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button 
            onClick={onClose}
            sx={{
              fontFamily: '"Kalnia Glaze", serif',
              fontWeight: 500,
              fontSize: '1.1rem'
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!isFormValid()}
            startIcon={isScheduled ? <Schedule /> : <Send />}
            sx={{
              fontFamily: '"Kalnia Glaze", serif',
              fontWeight: 500,
              fontSize: '1.1rem',
              background: isScheduled 
                ? 'linear-gradient(45deg, #667eea, #764ba2)'
                : 'linear-gradient(45deg, #f093fb, #f5576c)',
              '&:hover': {
                background: isScheduled 
                  ? 'linear-gradient(45deg, #764ba2, #667eea)'
                  : 'linear-gradient(45deg, #f5576c, #4facfe)',
              }
            }}
          >
            {isScheduled ? 'Schedule Post' : 'Post Now'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};