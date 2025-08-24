import { useState, useEffect } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import { MobileUtils } from '../utils/mobile';

export interface ResponsiveInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  viewportHeight: number;
  viewportWidth: number;
  orientation: 'portrait' | 'landscape';
}

export const useResponsive = (): ResponsiveInfo => {
  const theme = useTheme();
  const isMobileQuery = useMediaQuery(theme.breakpoints.down('md'));
  const isTabletQuery = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktopQuery = useMediaQuery(theme.breakpoints.up('lg'));

  const [viewportDimensions, setViewportDimensions] = useState({
    height: MobileUtils.getViewportHeight(),
    width: MobileUtils.getViewportWidth()
  });

  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  );

  useEffect(() => {
    const handleResize = () => {
      const height = MobileUtils.getViewportHeight();
      const width = MobileUtils.getViewportWidth();
      
      setViewportDimensions({ height, width });
      setOrientation(height > width ? 'portrait' : 'landscape');
    };

    // Use visual viewport API if available for better mobile support
    MobileUtils.onViewportChange(handleResize);

    // Fallback for orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 100); // Small delay to ensure dimensions are updated
    });

    return () => {
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return {
    isMobile: isMobileQuery || MobileUtils.isMobile(),
    isTablet: isTabletQuery,
    isDesktop: isDesktopQuery,
    isTouchDevice: MobileUtils.isTouchDevice(),
    viewportHeight: viewportDimensions.height,
    viewportWidth: viewportDimensions.width,
    orientation
  };
};

export const useBreakpoint = () => {
  const theme = useTheme();
  
  return {
    xs: useMediaQuery(theme.breakpoints.only('xs')),
    sm: useMediaQuery(theme.breakpoints.only('sm')),
    md: useMediaQuery(theme.breakpoints.only('md')),
    lg: useMediaQuery(theme.breakpoints.only('lg')),
    xl: useMediaQuery(theme.breakpoints.only('xl')),
    up: {
      xs: useMediaQuery(theme.breakpoints.up('xs')),
      sm: useMediaQuery(theme.breakpoints.up('sm')),
      md: useMediaQuery(theme.breakpoints.up('md')),
      lg: useMediaQuery(theme.breakpoints.up('lg')),
      xl: useMediaQuery(theme.breakpoints.up('xl'))
    },
    down: {
      xs: useMediaQuery(theme.breakpoints.down('xs')),
      sm: useMediaQuery(theme.breakpoints.down('sm')),
      md: useMediaQuery(theme.breakpoints.down('md')),
      lg: useMediaQuery(theme.breakpoints.down('lg')),
      xl: useMediaQuery(theme.breakpoints.down('xl'))
    }
  };
};