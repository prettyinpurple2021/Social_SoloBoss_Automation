import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Dashboard } from '../Dashboard';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Dashboard', () => {
  it('renders dashboard with correct title', () => {
    renderWithProviders(<Dashboard />);
    
    expect(screen.getByText('Social Media Automation')).toBeInTheDocument();
  });

  it('displays all three main tabs', () => {
    renderWithProviders(<Dashboard />);
    
    expect(screen.getByText('Posts')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Platforms')).toBeInTheDocument();
  });

  it('shows create post button', () => {
    renderWithProviders(<Dashboard />);
    
    expect(screen.getByText('Create Post')).toBeInTheDocument();
  });

  it('opens post form when create post button is clicked', async () => {
    renderWithProviders(<Dashboard />);
    
    const createButton = screen.getByText('Create Post');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(screen.getByText('Create New Post')).toBeInTheDocument();
    });
  });

  it('switches between tabs correctly', () => {
    renderWithProviders(<Dashboard />);
    
    // Initially shows Posts tab content
    expect(screen.getByText('Your Posts')).toBeInTheDocument();
    
    // Click Calendar tab
    const calendarTab = screen.getByText('Calendar');
    fireEvent.click(calendarTab);
    
    expect(screen.getByText('Calendar View')).toBeInTheDocument();
    
    // Click Platforms tab
    const platformsTab = screen.getByText('Platforms');
    fireEvent.click(platformsTab);
    
    expect(screen.getByText('Platform Connections')).toBeInTheDocument();
  });

  it('displays user menu when account icon is clicked', async () => {
    renderWithProviders(<Dashboard />);
    
    const accountButton = screen.getByLabelText('account of current user');
    fireEvent.click(accountButton);
    
    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });
});