import React from 'react';
import { Box, Container } from '@mui/material';
import { useResponsive } from '../../hooks/useResponsive';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disableGutters?: boolean;
  fullHeight?: boolean;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  maxWidth = 'lg',
  disableGutters = false,
  fullHeight = false
}) => {
  const { isMobile, isTablet, viewportHeight } = useResponsive();

  const getContainerProps = () => {
    if (isMobile) {
      return {
        maxWidth: 'sm' as const,
        disableGutters: true,
        sx: {
          px: 1,
          py: 0,
          minHeight: fullHeight ? `${viewportHeight}px` : 'auto'
        }
      };
    }

    if (isTablet) {
      return {
        maxWidth: 'md' as const,
        disableGutters,
        sx: {
          px: 2,
          py: 1,
          minHeight: fullHeight ? '100vh' : 'auto'
        }
      };
    }

    return {
      maxWidth,
      disableGutters,
      sx: {
        px: 3,
        py: 2,
        minHeight: fullHeight ? '100vh' : 'auto'
      }
    };
  };

  const containerProps = getContainerProps();

  return (
    <Container {...containerProps}>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          // Ensure touch targets are at least 44px on mobile
          '& .MuiButton-root': {
            minHeight: isMobile ? 44 : 36,
            minWidth: isMobile ? 44 : 'auto'
          },
          '& .MuiIconButton-root': {
            minHeight: isMobile ? 44 : 40,
            minWidth: isMobile ? 44 : 40
          },
          '& .MuiChip-root': {
            minHeight: isMobile ? 36 : 32
          },
          // Improve text readability on mobile
          '& .MuiTypography-body1': {
            fontSize: isMobile ? '1rem' : '0.875rem',
            lineHeight: isMobile ? 1.6 : 1.5
          },
          '& .MuiTypography-body2': {
            fontSize: isMobile ? '0.9rem' : '0.75rem',
            lineHeight: isMobile ? 1.5 : 1.4
          },
          // Improve form field spacing on mobile
          '& .MuiTextField-root': {
            mb: isMobile ? 2 : 1.5
          },
          // Improve card spacing
          '& .MuiCard-root': {
            mb: isMobile ? 2 : 1.5,
            mx: isMobile ? 0 : 'auto'
          }
        }}
      >
        {children}
      </Box>
    </Container>
  );
};

// Specialized layouts for different screen sizes
export const MobileOnlyLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isMobile } = useResponsive();
  
  if (!isMobile) {
    return null;
  }

  return <ResponsiveLayout maxWidth="sm" disableGutters>{children}</ResponsiveLayout>;
};

export const DesktopOnlyLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isMobile, isTablet } = useResponsive();
  
  if (isMobile || isTablet) {
    return null;
  }

  return <ResponsiveLayout maxWidth="lg">{children}</ResponsiveLayout>;
};

export const TabletAndUpLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isMobile } = useResponsive();
  
  if (isMobile) {
    return null;
  }

  return <ResponsiveLayout maxWidth="md">{children}</ResponsiveLayout>;
};