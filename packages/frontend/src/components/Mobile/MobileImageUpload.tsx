import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardMedia,
  CardActions,
  Fab,
  Snackbar,
  Alert,
  CircularProgress,
  Typography
} from '@mui/material';
import {
  PhotoCamera,
  PhotoLibrary,
  Delete,
  Edit,
  Close,
  CropFree,
  Compress
} from '@mui/icons-material';
import { ImageCaptureUtils, HapticUtils } from '../../utils/mobile';
import { useResponsive } from '../../hooks/useResponsive';

interface MobileImageUploadProps {
  onImagesChange: (files: File[]) => void;
  maxImages?: number;
  maxFileSize?: number; // in MB
  initialImages?: File[];
}

interface ImageWithPreview {
  file: File;
  preview: string;
  id: string;
}

export const MobileImageUpload: React.FC<MobileImageUploadProps> = ({
  onImagesChange,
  maxImages = 4,
  maxFileSize = 10,
  initialImages = []
}) => {
  const { isMobile } = useResponsive();
  const [images, setImages] = useState<ImageWithPreview[]>(() =>
    initialImages.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: Math.random().toString(36).substr(2, 9)
    }))
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [editingImage, setEditingImage] = useState<ImageWithPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCameraCapture = async () => {
    if (!isMobile) {
      setError('Camera capture is only available on mobile devices');
      return;
    }

    setIsCapturing(true);
    HapticUtils.lightTap();

    try {
      const file = await ImageCaptureUtils.captureFromCamera();
      if (file) {
        await addImage(file);
        HapticUtils.success();
      }
    } catch (error) {
      console.error('Camera capture failed:', error);
      setError('Failed to capture image from camera');
      HapticUtils.error();
    } finally {
      setIsCapturing(false);
    }
  };

  const handleGallerySelect = async () => {
    HapticUtils.lightTap();

    try {
      const files = await ImageCaptureUtils.selectFromGallery();
      for (const file of files) {
        if (images.length >= maxImages) break;
        await addImage(file);
      }
      if (files.length > 0) {
        HapticUtils.success();
      }
    } catch (error) {
      console.error('Gallery selection failed:', error);
      setError('Failed to select images from gallery');
      HapticUtils.error();
    }
  };

  const addImage = async (file: File) => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      setError(`Image size must be less than ${maxFileSize}MB`);
      return;
    }

    // Check max images
    if (images.length >= maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Resize image for mobile optimization
    const resizedFile = await ImageCaptureUtils.resizeImage(file, 1920, 1080, 0.8);
    
    const newImage: ImageWithPreview = {
      file: resizedFile,
      preview: URL.createObjectURL(resizedFile),
      id: Math.random().toString(36).substr(2, 9)
    };

    const updatedImages = [...images, newImage];
    setImages(updatedImages);
    onImagesChange(updatedImages.map(img => img.file));
  };

  const removeImage = (id: string) => {
    HapticUtils.mediumTap();
    const updatedImages = images.filter(img => {
      if (img.id === id) {
        URL.revokeObjectURL(img.preview);
        return false;
      }
      return true;
    });
    setImages(updatedImages);
    onImagesChange(updatedImages.map(img => img.file));
  };

  const handleEditImage = (image: ImageWithPreview) => {
    HapticUtils.lightTap();
    setEditingImage(image);
  };

  const handleImageEdit = async (editedFile: File) => {
    if (!editingImage) return;

    const updatedImages = images.map(img => {
      if (img.id === editingImage.id) {
        URL.revokeObjectURL(img.preview);
        return {
          ...img,
          file: editedFile,
          preview: URL.createObjectURL(editedFile)
        };
      }
      return img;
    });

    setImages(updatedImages);
    onImagesChange(updatedImages.map(img => img.file));
    setEditingImage(null);
    HapticUtils.success();
  };

  return (
    <Box>
      {/* Image Grid */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {images.map((image) => (
          <Grid item xs={6} sm={4} md={3} key={image.id}>
            <Card
              sx={{
                position: 'relative',
                aspectRatio: '1',
                '&:hover .image-actions': {
                  opacity: 1
                }
              }}
            >
              <CardMedia
                component="img"
                image={image.preview}
                alt="Uploaded image"
                sx={{
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              <CardActions
                className="image-actions"
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  left: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.5)',
                  opacity: isMobile ? 1 : 0,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => handleEditImage(image)}
                  sx={{ color: 'white', bgcolor: 'rgba(255, 255, 255, 0.2)' }}
                >
                  <Edit />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => removeImage(image.id)}
                  sx={{ color: 'white', bgcolor: 'rgba(255, 255, 255, 0.2)' }}
                >
                  <Delete />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Upload Controls */}
      {images.length < maxImages && (
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          {isMobile && (
            <Fab
              color="primary"
              onClick={handleCameraCapture}
              disabled={isCapturing}
              sx={{ minWidth: 120 }}
            >
              {isCapturing ? <CircularProgress size={24} /> : <PhotoCamera />}
            </Fab>
          )}
          
          <Fab
            color="secondary"
            onClick={handleGallerySelect}
            sx={{ minWidth: 120 }}
          >
            <PhotoLibrary />
          </Fab>
        </Box>
      )}

      {/* Hidden file input for fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          files.forEach(addImage);
        }}
      />

      {/* Image Editor Dialog */}
      <ImageEditorDialog
        image={editingImage}
        open={!!editingImage}
        onClose={() => setEditingImage(null)}
        onSave={handleImageEdit}
      />

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Simple Image Editor Dialog
interface ImageEditorDialogProps {
  image: ImageWithPreview | null;
  open: boolean;
  onClose: () => void;
  onSave: (file: File) => void;
}

const ImageEditorDialog: React.FC<ImageEditorDialogProps> = ({
  image,
  open,
  onClose,
  onSave
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCompress = async () => {
    if (!image) return;

    setIsProcessing(true);
    try {
      const compressedFile = await ImageCaptureUtils.resizeImage(
        image.file,
        1280,
        720,
        0.6
      );
      onSave(compressedFile);
    } catch (error) {
      console.error('Compression failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHighQuality = async () => {
    if (!image) return;

    setIsProcessing(true);
    try {
      const highQualityFile = await ImageCaptureUtils.resizeImage(
        image.file,
        1920,
        1080,
        0.9
      );
      onSave(highQualityFile);
    } catch (error) {
      console.error('High quality processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit Image
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {image && (
          <Box>
            <img
              src={image.preview}
              alt="Edit preview"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '300px',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
            />
            
            <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
              File size: {(image.file.size / 1024 / 1024).toFixed(2)} MB
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={handleCompress}
          disabled={isProcessing}
          startIcon={isProcessing ? <CircularProgress size={16} /> : <Compress />}
          variant="outlined"
        >
          Compress
        </Button>
        
        <Button
          onClick={handleHighQuality}
          disabled={isProcessing}
          startIcon={isProcessing ? <CircularProgress size={16} /> : <CropFree />}
          variant="contained"
        >
          High Quality
        </Button>
      </DialogActions>
    </Dialog>
  );
};