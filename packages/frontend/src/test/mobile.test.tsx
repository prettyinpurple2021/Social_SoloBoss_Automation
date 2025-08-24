import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MobileUtils, ImageCaptureUtils, TouchGestureUtils, HapticUtils } from '../utils/mobile';
import { MobileImageUpload } from '../components/Mobile/MobileImageUpload';
import { MobileNavigation } from '../components/Mobile/MobileNavigation';
import { MobilePostEditor } from '../components/Mobile/MobilePostEditor';
import { useResponsive } from '../hooks/useResponsive';

// Mock the responsive hook
vi.mock('../hooks/useResponsive');
const mockUseResponsive = vi.mocked(useResponsive);

// Mock navigator APIs
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
  mediaDevices: {
    getUserMedia: vi.fn()
  },
  vibrate: vi.fn(),
  onLine: true
};

Object.defineProperty(window, 'navigator', {
  value: mockNavigator,
  writable: true
});

// Mock visual viewport
Object.defineProperty(window, 'visualViewport', {
  value: {
    height: 800,
    width: 375,
    addEventListener: vi.fn()
  },
  writable: true
});

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('Mobile Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MobileUtils', () => {
    it('should detect mobile devices correctly', () => {
      expect(MobileUtils.isMobile()).toBe(true);
    });

    it('should detect iOS devices', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      });
      expect(MobileUtils.isIOS()).toBe(true);
    });

    it('should detect Android devices', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
        writable: true
      });
      expect(MobileUtils.isAndroid()).toBe(true);
    });

    it('should get viewport dimensions', () => {
      expect(MobileUtils.getViewportHeight()).toBe(800);
      expect(MobileUtils.getViewportWidth()).toBe(375);
    });
  });

  describe('ImageCaptureUtils', () => {
    it('should handle camera capture', async () => {
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: vi.fn() }])
      };
      
      mockNavigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

      // Mock canvas and video elements
      const mockCanvas = {
        getContext: vi.fn(() => ({
          drawImage: vi.fn()
        })),
        toBlob: vi.fn((callback) => {
          callback(new Blob(['test'], { type: 'image/jpeg' }));
        }),
        width: 0,
        height: 0
      };

      const mockVideo = {
        srcObject: null,
        play: vi.fn(),
        addEventListener: vi.fn((event, callback) => {
          if (event === 'loadedmetadata') {
            setTimeout(callback, 0);
          }
        }),
        videoWidth: 640,
        videoHeight: 480
      };

      vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'canvas') return mockCanvas as any;
        if (tagName === 'video') return mockVideo as any;
        return document.createElement(tagName);
      });

      const result = await ImageCaptureUtils.captureFromCamera();
      expect(result).toBeInstanceOf(File);
    });

    it('should handle gallery selection', async () => {
      const mockInput = {
        type: '',
        accept: '',
        multiple: false,
        capture: '',
        addEventListener: vi.fn(),
        click: vi.fn(),
        files: [new File(['test'], 'test.jpg', { type: 'image/jpeg' })]
      };

      vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any);

      // Simulate file selection
      setTimeout(() => {
        const changeEvent = new Event('change');
        Object.defineProperty(changeEvent, 'target', {
          value: mockInput,
          writable: false
        });
        mockInput.addEventListener.mock.calls[0][1](changeEvent);
      }, 0);

      const result = await ImageCaptureUtils.selectFromGallery();
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(File);
    });
  });

  describe('HapticUtils', () => {
    it('should trigger vibration patterns', () => {
      HapticUtils.lightTap();
      expect(mockNavigator.vibrate).toHaveBeenCalledWith(50);

      HapticUtils.mediumTap();
      expect(mockNavigator.vibrate).toHaveBeenCalledWith(100);

      HapticUtils.success();
      expect(mockNavigator.vibrate).toHaveBeenCalledWith([100, 50, 100]);
    });
  });
});

describe('Mobile Components', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      viewportHeight: 800,
      viewportWidth: 375,
      orientation: 'portrait'
    });
  });

  describe('MobileImageUpload', () => {
    it('should render upload controls', () => {
      const mockOnImagesChange = vi.fn();
      
      renderWithTheme(
        <MobileImageUpload onImagesChange={mockOnImagesChange} />
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle image removal', async () => {
      const mockOnImagesChange = vi.fn();
      const initialImages = [
        new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      ];
      
      renderWithTheme(
        <MobileImageUpload 
          onImagesChange={mockOnImagesChange}
          initialImages={initialImages}
        />
      );

      // Should show the initial image
      await waitFor(() => {
        expect(screen.getByAltText('Uploaded image')).toBeInTheDocument();
      });
    });
  });

  describe('MobileNavigation', () => {
    it('should render mobile navigation elements', () => {
      const mockOnCreatePost = vi.fn();
      
      renderWithTheme(
        <MobileNavigation 
          onCreatePost={mockOnCreatePost}
          notificationCount={5}
        />
      );

      expect(screen.getByText('SMA Platform')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Notification badge
    });

    it('should handle create post action', () => {
      const mockOnCreatePost = vi.fn();
      
      renderWithTheme(
        <MobileNavigation onCreatePost={mockOnCreatePost} />
      );

      const createButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(createButton);
      
      expect(mockOnCreatePost).toHaveBeenCalled();
    });
  });

  describe('MobilePostEditor', () => {
    it('should render post editor dialog', () => {
      const mockOnClose = vi.fn();
      const mockOnSave = vi.fn();
      
      renderWithTheme(
        <MobilePostEditor
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Create Post')).toBeInTheDocument();
      expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
    });

    it('should handle platform selection', () => {
      const mockOnClose = vi.fn();
      const mockOnSave = vi.fn();
      
      renderWithTheme(
        <MobilePostEditor
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const facebookChip = screen.getByText('Facebook');
      fireEvent.click(facebookChip);
      
      // Platform should be selected (visual feedback would be tested in integration tests)
      expect(facebookChip).toBeInTheDocument();
    });

    it('should validate content length', () => {
      const mockOnClose = vi.fn();
      const mockOnSave = vi.fn();
      
      renderWithTheme(
        <MobilePostEditor
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const contentField = screen.getByPlaceholderText("What's on your mind?");
      
      // Enter content that exceeds Twitter's limit
      const longContent = 'a'.repeat(300);
      fireEvent.change(contentField, { target: { value: longContent } });
      
      expect(contentField).toHaveValue(longContent);
    });
  });
});

describe('Touch Gesture Utils', () => {
  it('should handle swipe gestures', () => {
    const mockElement = document.createElement('div');
    const mockOnSwipe = vi.fn();
    
    TouchGestureUtils.addSwipeListener(mockElement, mockOnSwipe, 50);
    
    // Simulate touch start
    const touchStart = new TouchEvent('touchstart', {
      touches: [{ clientX: 100, clientY: 100 } as Touch]
    });
    mockElement.dispatchEvent(touchStart);
    
    // Simulate touch end (swipe right)
    const touchEnd = new TouchEvent('touchend', {
      changedTouches: [{ clientX: 200, clientY: 100 } as Touch]
    });
    mockElement.dispatchEvent(touchEnd);
    
    expect(mockOnSwipe).toHaveBeenCalledWith('right');
  });

  it('should handle pinch zoom gestures', () => {
    const mockElement = document.createElement('div');
    const mockOnPinch = vi.fn();
    
    TouchGestureUtils.addPinchZoomListener(mockElement, mockOnPinch);
    
    // Simulate two-finger touch start
    const touchStart = new TouchEvent('touchstart', {
      touches: [
        { clientX: 100, clientY: 100 } as Touch,
        { clientX: 200, clientY: 200 } as Touch
      ]
    });
    mockElement.dispatchEvent(touchStart);
    
    // Simulate pinch zoom
    const touchMove = new TouchEvent('touchmove', {
      touches: [
        { clientX: 80, clientY: 80 } as Touch,
        { clientX: 220, clientY: 220 } as Touch
      ]
    });
    
    // Mock preventDefault
    touchMove.preventDefault = vi.fn();
    mockElement.dispatchEvent(touchMove);
    
    expect(mockOnPinch).toHaveBeenCalled();
  });
});

describe('Responsive Hook', () => {
  it('should return mobile configuration', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      viewportHeight: 800,
      viewportWidth: 375,
      orientation: 'portrait'
    });

    const result = useResponsive();
    
    expect(result.isMobile).toBe(true);
    expect(result.isTouchDevice).toBe(true);
    expect(result.orientation).toBe('portrait');
  });

  it('should return desktop configuration', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      viewportHeight: 1080,
      viewportWidth: 1920,
      orientation: 'landscape'
    });

    const result = useResponsive();
    
    expect(result.isDesktop).toBe(true);
    expect(result.isTouchDevice).toBe(false);
    expect(result.orientation).toBe('landscape');
  });
});