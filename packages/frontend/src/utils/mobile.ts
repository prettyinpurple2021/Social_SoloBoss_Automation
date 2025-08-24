// Mobile device detection and utilities
export class MobileUtils {
  static isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  static isAndroid(): boolean {
    return /Android/.test(navigator.userAgent);
  }

  static isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  static getViewportHeight(): number {
    return window.visualViewport?.height || window.innerHeight;
  }

  static getViewportWidth(): number {
    return window.visualViewport?.width || window.innerWidth;
  }

  // Handle viewport changes (useful for keyboard appearance on mobile)
  static onViewportChange(callback: (height: number, width: number) => void) {
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        callback(this.getViewportHeight(), this.getViewportWidth());
      });
    } else {
      window.addEventListener('resize', () => {
        callback(this.getViewportHeight(), this.getViewportWidth());
      });
    }
  }
}

// Image capture and handling utilities
export class ImageCaptureUtils {
  static async captureFromCamera(): Promise<File | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Use back camera by default
        audio: false
      });

      return new Promise((resolve) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        video.srcObject = stream;
        video.play();

        video.addEventListener('loadedmetadata', () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // Capture frame after a short delay
          setTimeout(() => {
            if (context) {
              context.drawImage(video, 0, 0);
              canvas.toBlob((blob) => {
                stream.getTracks().forEach(track => track.stop());
                if (blob) {
                  const file = new File([blob], `camera-${Date.now()}.jpg`, {
                    type: 'image/jpeg'
                  });
                  resolve(file);
                } else {
                  resolve(null);
                }
              }, 'image/jpeg', 0.8);
            } else {
              resolve(null);
            }
          }, 1000);
        });
      });
    } catch (error) {
      console.error('Error accessing camera:', error);
      return null;
    }
  }

  static async selectFromGallery(): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.capture = 'environment'; // Prefer camera on mobile

      input.addEventListener('change', (event) => {
        const files = Array.from((event.target as HTMLInputElement).files || []);
        resolve(files);
      });

      input.click();
    });
  }

  static async resizeImage(file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        if (context) {
          context.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(resizedFile);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', quality);
        } else {
          resolve(file);
        }
      };

      img.src = URL.createObjectURL(file);
    });
  }

  static async cropImage(file: File, cropArea: { x: number; y: number; width: number; height: number }): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = cropArea.width;
        canvas.height = cropArea.height;

        if (context) {
          context.drawImage(
            img,
            cropArea.x, cropArea.y, cropArea.width, cropArea.height,
            0, 0, cropArea.width, cropArea.height
          );

          canvas.toBlob((blob) => {
            if (blob) {
              const croppedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(croppedFile);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.9);
        } else {
          resolve(file);
        }
      };

      img.src = URL.createObjectURL(file);
    });
  }
}

// Touch gesture utilities
export class TouchGestureUtils {
  static addSwipeListener(
    element: HTMLElement,
    onSwipe: (direction: 'left' | 'right' | 'up' | 'down') => void,
    threshold: number = 50
  ) {
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;

    element.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });

    element.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].clientX;
      endY = e.changedTouches[0].clientY;

      const deltaX = endX - startX;
      const deltaY = endY - startY;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > threshold) {
          onSwipe(deltaX > 0 ? 'right' : 'left');
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) > threshold) {
          onSwipe(deltaY > 0 ? 'down' : 'up');
        }
      }
    });
  }

  static addPinchZoomListener(
    element: HTMLElement,
    onPinch: (scale: number) => void
  ) {
    let initialDistance = 0;
    // let currentScale = 1;

    element.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialDistance = this.getDistance(e.touches[0], e.touches[1]);
      }
    });

    element.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance;
        // currentScale = scale;
        onPinch(scale);
      }
    });

    element.addEventListener('touchend', () => {
      initialDistance = 0;
      // currentScale = 1;
    });
  }

  private static getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// Haptic feedback utilities
export class HapticUtils {
  static vibrate(pattern: number | number[] = 200) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  static lightTap() {
    this.vibrate(50);
  }

  static mediumTap() {
    this.vibrate(100);
  }

  static heavyTap() {
    this.vibrate(200);
  }

  static success() {
    this.vibrate([100, 50, 100]);
  }

  static error() {
    this.vibrate([200, 100, 200, 100, 200]);
  }
}