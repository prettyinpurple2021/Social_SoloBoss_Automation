import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  IconButton,
  Autocomplete,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Close,
  Add,
  Schedule,
  Facebook,
  Instagram,
  Pinterest,
  X as XIcon,
  Image,
  CalendarToday,
  Category,
  Tag,
  AutoAwesome
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Platform } from '@sma/shared/types/platform';
import { Post, PostData } from '@sma/shared/types/post';
import { postsApi } from '../../services/postsApi';
import dayjs, { Dayjs } from 'dayjs';

interface PostEditorProps {
  open: boolean;
  onClose: () => void;
  post?: Post;
  onSave?: (post: Post) => void;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Tag {
  id: string;
  name: string;
}

const platformIcons = {
  [Platform.FACEBOOK]: <Facebook />,
  [Platform.INSTAGRAM]: <Instagram />,
  [Platform.PINTEREST]: <Pinterest />,
  [Platform.X]: <XIcon />
};

const platformColors = {
  [Platform.FACEBOOK]: '#1877F2',
  [Platform.INSTAGRAM]: '#E4405F',
  [Platform.PINTEREST]: '#BD081C',
  [Platform.X]: '#000000'
};

export const PostEditor: React.FC<PostEditorProps> = ({
  open,
  onClose,
  post,
  onSave
}) => {
  const [content, setContent] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [scheduledTime, setScheduledTime] = useState<Dayjs | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Available categories and tags (would be fetched from API)
  const [availableCategories] = useState<Category[]>([
    { id: '1', name: 'Marketing', color: '#FF5722' },
    { id: '2', name: 'Educational', color: '#2196F3' },
    { id: '3', name: 'Personal', color: '#4CAF50' },
    { id: '4', name: 'Business', color: '#FF9800' }
  ]);
  
  const [availableTags] = useState<Tag[]>([
    { id: '1', name: 'motivation' },
    { id: '2', name: 'tips' },
    { id: '3', name: 'announcement' },
    { id: '4', name: 'behind-the-scenes' }
  ]);

  // Suggested categories and tags
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  useEffect(() => {
    if (post) {
      setContent(post.content);
      setPlatforms(post.platforms);
      setScheduledTime(post.scheduledTime ? dayjs(post.scheduledTime) : null);
      setImages(post.images || []);
      setHashtags(post.hashtags || []);
      setCategories(post.metadata?.categories || []);
      setTags(post.metadata?.tags || []);
    } else {
      // Reset form for new post
      setContent('');
      setPlatforms([]);
      setScheduledTime(null);
      setImages([]);
      setHashtags([]);
      setCategories([]);
      setTags([]);
    }
    setError(null);
  }, [post, open]);

  // Auto-suggest categories and tags when content changes
  useEffect(() => {
    if (content.length > 20) {
      // Mock suggestions based on content
      const contentLower = content.toLowerCase();
      const newSuggestedCategories: string[] = [];
      const newSuggestedTags: string[] = [];

      if (contentLower.includes('tip') || contentLower.includes('learn')) {
        newSuggestedCategories.push('Educational');
        newSuggestedTags.push('tips');
      }
      if (contentLower.includes('sale') || contentLower.includes('offer')) {
        newSuggestedCategories.push('Marketing');
      }
      if (contentLower.includes('personal') || contentLower.includes('story')) {
        newSuggestedCategories.push('Personal');
      }
      if (contentLower.includes('motivat')) {
        newSuggestedTags.push('motivation');
      }

      setSuggestedCategories(newSuggestedCategories);
      setSuggestedTags(newSuggestedTags);
    } else {
      setSuggestedCategories([]);
      setSuggestedTags([]);
    }
  }, [content]);

  const handlePlatformToggle = (platform: Platform) => {
    setPlatforms(prev => 
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleHashtagAdd = (hashtag: string) => {
    const cleanHashtag = hashtag.replace('#', '').trim();
    if (cleanHashtag && !hashtags.includes(`#${cleanHashtag}`)) {
      setHashtags(prev => [...prev, `#${cleanHashtag}`]);
    }
  };

  const handleHashtagRemove = (hashtag: string) => {
    setHashtags(prev => prev.filter(h => h !== hashtag));
  };

  const handleCategoryAdd = (categoryName: string) => {
    if (!categories.includes(categoryName)) {
      setCategories(prev => [...prev, categoryName]);
    }
  };

  const handleCategoryRemove = (categoryName: string) => {
    setCategories(prev => prev.filter(c => c !== categoryName));
  };

  const handleTagAdd = (tagName: string) => {
    if (!tags.includes(tagName)) {
      setTags(prev => [...prev, tagName]);
    }
  };

  const handleTagRemove = (tagName: string) => {
    setTags(prev => prev.filter(t => t !== tagName));
  };

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    if (platforms.length === 0) {
      setError('At least one platform must be selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const postData: PostData = {
        content: content.trim(),
        platforms,
        scheduledTime: scheduledTime?.toDate(),
        images,
        hashtags,
        metadata: {
          categories,
          tags
        }
      };

      let savedPost: Post;
      if (post) {
        const response = await postsApi.updatePost(post.id, postData);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to update post');
        }
        savedPost = response.data;
      } else {
        const response = await postsApi.createPost(postData);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to create post');
        }
        savedPost = response.data;
      }

      onSave?.(savedPost);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save post');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (categoryName: string) => {
    const category = availableCategories.find(c => c.name === categoryName);
    return category?.color || '#2196F3';
  };

  const getCharacterCount = () => {
    const maxLength = platforms.includes(Platform.X) ? 280 : 2200;
    return `${content.length}/${maxLength}`;
  };

  const isOverLimit = () => {
    const maxLength = platforms.includes(Platform.X) ? 280 : 2200;
    return content.length > maxLength;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              {post ? 'Edit Post' : 'Create New Post'}
            </Typography>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Content */}
            <Box>
              <TextField
                label="Post Content"
                multiline
                rows={6}
                fullWidth
                value={content}
                onChange={(e) => setContent(e.target.value)}
                error={isOverLimit()}
                helperText={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{isOverLimit() ? 'Content exceeds character limit' : 'Write your post content'}</span>
                    <span style={{ color: isOverLimit() ? 'error.main' : 'text.secondary' }}>
                      {getCharacterCount()}
                    </span>
                  </Box>
                }
              />
            </Box>

            {/* Platform Selection */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Select Platforms
              </Typography>
              <Grid container spacing={1}>
                {Object.values(Platform).map((platform) => (
                  <Grid item key={platform}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: platforms.includes(platform) ? 2 : 1,
                        borderColor: platforms.includes(platform) 
                          ? platformColors[platform] 
                          : 'divider',
                        '&:hover': {
                          borderColor: platformColors[platform]
                        }
                      }}
                      onClick={() => handlePlatformToggle(platform)}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ color: platformColors[platform] }}>
                            {platformIcons[platform]}
                          </Box>
                          <Typography variant="body2">
                            {platform.charAt(0).toUpperCase() + platform.slice(1)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Scheduling */}
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={scheduledTime !== null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setScheduledTime(dayjs().add(1, 'hour'));
                      } else {
                        setScheduledTime(null);
                      }
                    }}
                  />
                }
                label="Schedule for later"
              />
              {scheduledTime && (
                <Box sx={{ mt: 2 }}>
                  <DateTimePicker
                    label="Scheduled Time"
                    value={scheduledTime}
                    onChange={(newValue) => setScheduledTime(newValue)}
                    minDateTime={dayjs()}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        InputProps: {
                          startAdornment: <CalendarToday sx={{ mr: 1, color: 'action.active' }} />
                        }
                      }
                    }}
                  />
                </Box>
              )}
            </Box>

            {/* Hashtags */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Hashtags
              </Typography>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={hashtags}
                onChange={(_, newValue) => setHashtags(newValue)}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Add hashtags (press Enter)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        e.preventDefault();
                        handleHashtagAdd(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                )}
              />
            </Box>

            {/* Categories */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Category fontSize="small" />
                Categories
              </Typography>
              
              {/* Suggested Categories */}
              {suggestedCategories.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <AutoAwesome fontSize="small" />
                    Suggested based on content:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {suggestedCategories.map((category) => (
                      <Chip
                        key={category}
                        label={category}
                        size="small"
                        variant="outlined"
                        onClick={() => handleCategoryAdd(category)}
                        sx={{ 
                          borderColor: getCategoryColor(category),
                          color: getCategoryColor(category)
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Selected Categories */}
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                {categories.map((category) => (
                  <Chip
                    key={category}
                    label={category}
                    onDelete={() => handleCategoryRemove(category)}
                    sx={{
                      backgroundColor: getCategoryColor(category),
                      color: 'white',
                      '& .MuiChip-deleteIcon': {
                        color: 'white'
                      }
                    }}
                  />
                ))}
              </Stack>

              {/* Available Categories */}
              <Autocomplete
                options={availableCategories.map(c => c.name)}
                value=""
                onChange={(_, newValue) => {
                  if (newValue) {
                    handleCategoryAdd(newValue);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Add categories"
                    size="small"
                  />
                )}
              />
            </Box>

            {/* Tags */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tag fontSize="small" />
                Tags
              </Typography>
              
              {/* Suggested Tags */}
              {suggestedTags.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <AutoAwesome fontSize="small" />
                    Suggested based on content:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {suggestedTags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        variant="outlined"
                        onClick={() => handleTagAdd(tag)}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Selected Tags */}
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleTagRemove(tag)}
                    variant="outlined"
                  />
                ))}
              </Stack>

              {/* Available Tags */}
              <Autocomplete
                options={availableTags.map(t => t.name)}
                value=""
                onChange={(_, newValue) => {
                  if (newValue) {
                    handleTagAdd(newValue);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Add tags"
                    size="small"
                  />
                )}
              />
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading || !content.trim() || platforms.length === 0 || isOverLimit()}
            startIcon={loading ? <CircularProgress size={20} /> : <Schedule />}
          >
            {loading ? 'Saving...' : post ? 'Update Post' : 'Create Post'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};