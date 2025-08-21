import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PlatformConnections } from '../PlatformConnections';
import { Platform, PlatformConnection } from '@sma/shared/types/platform';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockConnection: PlatformConnection = {
  id: '1',
  userId: 'user1',
  platform: Platform.FACEBOOK,
  platformUserId: 'fb_123',
  platformUsername: 'My Business Page',
  accessToken: 'encrypted_token',
  tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  isActive: true,
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  updatedAt: new Date()
};

describe('PlatformConnections', () => {
  it('renders platform connections title', () => {
    renderWithTheme(<PlatformConnections />);
    
    expect(screen.getByText('Platform Connections')).toBeInTheDocument();
  });

  it('shows info message when no connections exist', () => {
    renderWithTheme(<PlatformConnections connections={[]} />);
    
    expect(screen.getByText('No platforms connected yet. Connect your social media accounts to start posting.')).toBeInTheDocument();
  });

  it('displays connected platforms', () => {
    renderWithTheme(<PlatformConnections connections={[mockConnection]} />);
    
    expect(screen.getByText('Connected Accounts')).toBeInTheDocument();
    expect(screen.getByText('Facebook Business Page')).toBeInTheDocument();
    expect(screen.getByText('My Business Page')).toBeInTheDocument();
  });

  it('shows connection status correctly', () => {
    renderWithTheme(<PlatformConnections connections={[mockConnection]} />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('displays available platforms for connection', () => {
    renderWithTheme(<PlatformConnections connections={[mockConnection]} />);
    
    expect(screen.getByText('Available Platforms')).toBeInTheDocument();
    
    // Should show Instagram, Pinterest, and X as available (Facebook is already connected)
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText('Pinterest')).toBeInTheDocument();
    expect(screen.getByText('X (formerly Twitter)')).toBeInTheDocument();
  });

  it('calls onConnect when connect button is clicked', async () => {
    const mockOnConnect = vi.fn();
    
    renderWithTheme(
      <PlatformConnections 
        connections={[]} 
        onConnect={mockOnConnect}
      />
    );
    
    const connectButton = screen.getAllByText('Connect')[0];
    fireEvent.click(connectButton);
    
    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalled();
    });
  });

  it('shows disconnect button for connected platforms', () => {
    renderWithTheme(<PlatformConnections connections={[mockConnection]} />);
    
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('opens disconnect confirmation dialog', async () => {
    renderWithTheme(<PlatformConnections connections={[mockConnection]} />);
    
    const disconnectButton = screen.getByText('Disconnect');
    fireEvent.click(disconnectButton);
    
    await waitFor(() => {
      expect(screen.getByText('Disconnect Platform')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to disconnect this platform? You\'ll need to reconnect it to continue posting.')).toBeInTheDocument();
    });
  });

  it('calls onDisconnect when disconnect is confirmed', async () => {
    const mockOnDisconnect = vi.fn();
    
    renderWithTheme(
      <PlatformConnections 
        connections={[mockConnection]} 
        onDisconnect={mockOnDisconnect}
      />
    );
    
    const disconnectButton = screen.getByText('Disconnect');
    fireEvent.click(disconnectButton);
    
    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: 'Disconnect' });
      fireEvent.click(confirmButton);
    });
    
    expect(mockOnDisconnect).toHaveBeenCalledWith('1');
  });

  it('shows warning for expiring tokens', () => {
    const expiringConnection = {
      ...mockConnection,
      tokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    };
    
    renderWithTheme(<PlatformConnections connections={[expiringConnection]} />);
    
    expect(screen.getByText('Expires in 5 days')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('shows error for expired tokens', () => {
    const expiredConnection = {
      ...mockConnection,
      tokenExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    };
    
    renderWithTheme(<PlatformConnections connections={[expiredConnection]} />);
    
    expect(screen.getByText('Token expired')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', () => {
    const mockOnRefresh = vi.fn();
    const expiringConnection = {
      ...mockConnection,
      tokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    };
    
    renderWithTheme(
      <PlatformConnections 
        connections={[expiringConnection]} 
        onRefresh={mockOnRefresh}
      />
    );
    
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    
    expect(mockOnRefresh).toHaveBeenCalledWith('1');
  });

  it('shows connection date', () => {
    renderWithTheme(<PlatformConnections connections={[mockConnection]} />);
    
    expect(screen.getByText(/Connected .* ago/)).toBeInTheDocument();
  });

  it('disables connect button while connecting', async () => {
    renderWithTheme(<PlatformConnections connections={[]} />);
    
    const connectButton = screen.getAllByText('Connect')[0];
    fireEvent.click(connectButton);
    
    await waitFor(() => {
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });
});