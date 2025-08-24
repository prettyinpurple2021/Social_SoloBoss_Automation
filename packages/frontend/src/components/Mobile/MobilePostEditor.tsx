import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Chip,
  FormControlLabel,
  Switch,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,

  Alert
} from '@mui/material';
import {
  Close,
  Schedule,
  ExpandMore,
  Facebook,
  Instagram,
  Pinterest,
  Twitter,
  Send,
  Save
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs, { Dayjs } from 'dayjs';
import { MobileImageUpload } from './MobileImageUpload';
import { useResponsive } from '../../hooks/useResponsive';
import { HapticUtils } from '../../utils/mobile';

interface Platform {
  id: string;
  name: string;
  icon: React.ReactNode;
  maxLength: number;
  supportsImages: boolean;
}

const platforms: Platform[] = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: <Facebook />,
    maxLength: 63206,
    supportsImages: true
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: <Instagram />,
    maxLength: 2200,
    supportsImages: true
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: <Pinterest />,
    maxLength: 500,
    supportsImages: true
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    icon: <Twitter />,
    maxLength: 280,
    supportsImages: true
  }
];

interface MobilePostEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (postData: PostData) => Promise<void>;
  initialData?: Partial<PostData>;
}

interface PostData {
  content: string;
  platforms: string[];
  images: File[];
  scheduledTime?: Date;
  platformSpecificContent: Record<string, string>;
  hashtags: string[];
}

export const MobilePostEditor: React.FC<MobilePostEditorProps> = ({
  open,
  onClose,
  onSave,
  initialData
}) => {
  const { isMobile } = useResponsive();
  const [postData, setPostData] = useState<PostData>({
    content: '',
    platforms: [],
    images: [],
    platformSpecificContent: {},
    hashtags: [],
    ...initialData
  });
  const [scheduledTime, setScheduledTime] = useState<Dayjs | null>(
    initialData?.scheduledTime ? dayjs(initialData.scheduledTime) : null
  );
  const [isScheduled, setIsScheduled] = useState(!!initialData?.scheduledTime);
  const [isSaving, setIsSaving] = useState(false);
  const [currentHashtag, setCurrentHashtag] = useState('');
  const [expandedPlatform, setExpandedPlatform] = useState<string | false>(false);

  // Character count for current platform
  const getCharacterCount = (platformId: string) => {
    const content = postData.platformSpecificContent[platformId] || postData.content;
    return content.length;
  };

  const getMaxLength = (platformId: string) => {
    return platforms.find(p => p.id === platformId)?.maxLength || 280;
  };

  const handleContentChange = (value: string) => {
    setPostData(prev => ({ ...prev, content: value }));
  };

  const handlePlatformSpecificContentChange = (platformId: string, value: string) => {
    setPostData(prev => ({
      ...prev,
      platformSpecificContent: {
        ...prev.platformSpecificContent,
        [platformId]: value
      }
    }));
  };

  const handlePlatformToggle = (platformId: string) => {
    HapticUtils.lightTap();
    setPostData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platformId)
        ? prev.platforms.filter(p => p !== platformId)
        : [...prev.platforms, platformId]
    }));
  };

  const handleImagesChange = (files: File[]) => {
    setPostData(prev => ({ ...prev, images: files }));
  };

  const handleAddHashtag = () => {
    if (currentHashtag.trim() && !postData.hashtags.includes(currentHashtag.trim())) {
      HapticUtils.lightTap();
      setPostData(prev => ({
        ...prev,
        hashtags: [...prev.hashtags, currentHashtag.trim()]
      }));
      setCurrentHashtag('');
    }
  };

  const handleRemoveHashtag = (hashtag: string) => {
    HapticUtils.lightTap();
    setPostData(prev => ({
      ...prev,
      hashtags: prev.hashtags.filter(h => h !== hashtag)
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    HapticUtils.mediumTap();

    try {
      const finalData = {
        ...postData,
        scheduledTime: isScheduled && scheduledTime ? scheduledTime.toDate() : undefined
      };

      await onSave(finalData);
      HapticUtils.success();
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      HapticUtils.error();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    HapticUtils.lightTap();
    onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog
        open={open}
        onClose={handleClose}
        fullScreen={isMobile}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            height: isMobile ? '100vh' : 'auto',
            maxHeight: isMobile ? '100vh' : '90vh'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Create Post
          </Typography>
          <IconButton onClick={handleClose}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pb: 1 }}>
          {/* Main Content */}
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="What's on your mind?"
            value={postData.content}
            onChange={(e) => handleContentChange(e.target.value)}
            sx={{ mb: 2 }}
          />

          {/* Platform Selection */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Select Platforms
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {platforms.map((platform) => (
              <Chip
                key={platform.id}
                icon={platform.icon as React.ReactElement}
                label={platform.name}
                onClick={() => handlePlatformToggle(platform.id)}
                color={postData.platforms.includes(platform.id) ? 'primary' : 'default'}
                variant={postData.platforms.includes(platform.id) ? 'filled' : 'outlined'}
              />
            ))}
          </Box>

          {/* Platform-Specific Content */}
          {postData.platforms.map((platformId) => {
            const platform = platforms.find(p => p.id === platformId);
            if (!platform) return null;

            const charCount = getCharacterCount(platformId);
            const maxLength = getMaxLength(platformId);
            const isOverLimit = charCount > maxLength;

            return (
              <Accordion
                key={platformId}
                expanded={expandedPlatform === platformId}
                onChange={(_, isExpanded) => setExpandedPlatform(isExpanded ? platformId : false)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    {platform.icon}
                    <Typography>{platform.name}</Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography
                      variant="caption"
                      color={isOverLimit ? 'error' : 'text.secondary'}
                    >
                      {charCount}/{maxLength}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder={`Custom content for ${platform.name}...`}
                    value={postData.platformSpecificContent[platformId] || ''}
                    onChange={(e) => handlePlatformSpecificContentChange(platformId, e.target.value)}
                    error={isOverLimit}
                    helperText={isOverLimit ? `Content exceeds ${maxLength} character limit` : ''}
                  />
                </AccordionDetails>
              </Accordion>
            );
          })}

          {/* Image Upload */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Images
          </Typography>
          <MobileImageUpload
            onImagesChange={handleImagesChange}
            initialImages={postData.images}
            maxImages={4}
          />

          <Divider sx={{ my: 2 }} />

          {/* Hashtags */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Hashtags
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              placeholder="Add hashtag"
              value={currentHashtag}
              onChange={(e) => setCurrentHashtag(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddHashtag();
                }
              }}
              sx={{ flexGrow: 1 }}
            />
            <Button onClick={handleAddHashtag} variant="outlined" size="small">
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {postData.hashtags.map((hashtag) => (
              <Chip
                key={hashtag}
                label={`#${hashtag}`}
                size="small"
                onDelete={() => handleRemoveHashtag(hashtag)}
              />
            ))}
          </Box>

          {/* Scheduling */}
          <FormControlLabel
            control={
              <Switch
                checked={isScheduled}
                onChange={(e) => {
                  HapticUtils.lightTap();
                  setIsScheduled(e.target.checked);
                }}
              />
            }
            label="Schedule for later"
          />

          {isScheduled && (
            <Box sx={{ mt: 1 }}>
              <DateTimePicker
                label="Schedule time"
                value={scheduledTime}
                onChange={setScheduledTime}
                minDateTime={dayjs()}
                sx={{ width: '100%' }}
              />
            </Box>
          )}

          {/* Validation Alerts */}
          {postData.platforms.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Please select at least one platform
            </Alert>
          )}

          {postData.platforms.some(platformId => {
            const charCount = getCharacterCount(platformId);
            const maxLength = getMaxLength(platformId);
            return charCount > maxLength;
          }) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Some platform content exceeds character limits
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleSave}
            disabled={isSaving || postData.platforms.length === 0}
            startIcon={<Save />}
            variant="outlined"
          >
            Save Draft
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={
              isSaving || 
              postData.platforms.length === 0 ||
              postData.platforms.some(platformId => {
                const charCount = getCharacterCount(platformId);
                const maxLength = getMaxLength(platformId);
                return charCount > maxLength;
              })
            }
            startIcon={isScheduled ? <Schedule /> : <Send />}
            variant="contained"
          >
            {isScheduled ? 'Schedule' : 'Publish'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};