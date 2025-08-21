import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { Settings } from '../Settings';
import { settingsApi } from '../../../services/settingsApi';
import { UserSettings } from '../../../types/user';

// Mock the settings API
vi.mock('../../../services/settingsApi');
const mockSettingsApi = settingsApi as any;

// Mock the child components
vi.mock('../GeneralSettings', () => ({
  GeneralSettings: ({ settings, onUpdate, onReset }: any) => (
    <div data-testid="general-settings">
      <button onClick={() => onUpdate({ timezone: 'America/New_York' })}>
        Update Settings
      </button>
      <button onClick={onReset}>Reset Settings</button>
    </div>
  )
}));

vi.mock('../PlatformSettings', () => ({
  PlatformSettings: ({ platformPreferences, onUpdate }: any) => (
    <div data-testid="platform-settings">
      <button onClick={() => onUpdate({ facebook: { autoPost: true } })}>
        Update Platform
      </button>
    </div>
  )
}));

vi.mock('../NotificationSettings', () => ({
  NotificationSettings: ({ notificationSettings, onUpdate }: any) => (
    <div data-testid="notification-settings">
      <button onClick={() => onUpdate({ emailNotifications: false })}>
        Update Notifications
      </button>
    </div>
  )
}));

vi.mock('../IntegrationSettings', () => ({
  IntegrationSettings: ({ settings, onUpdate }: any) => (
    <div data-testid="integration-settings">
      <button onClick={() => onUpdate({ bloggerIntegrationEnabled: true })}>
        Update Integrations
      </button>
    </div>
  )
}));

describe('Settings', () => {
  const mockSettings: UserSettings = {
    timezone: 'UTC',
    defaultHashtags: ['test'],
    autoApproveFromSoloBoss: false,
    bloggerIntegrationEnabled: false,
    platformPreferences: {
      facebook: {
        defaultHashtags: [],
        contentFormat: 'full',
        includeLink: true,
        autoPost: false
      },
      instagram: {
        defaultHashtags: [],
        imageRequired: true,
        maxHashtags: 30,
        autoPost: false
      },
      pinterest: {
        defaultBoard: '',
        defaultHashtags: [],
        imageRequired: true,
        autoPost: false
      },
      x: {
        defaultHashtags: [],
        shortenLinks: true,
        threadLongContent: true,
        autoPost: false
      }
    },
    notificationSettings: {
      emailNotifications: true,
      failedPostNotifications: true,
      integrationIssueNotifications: true,
      weeklyReports: false
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockSettingsApi.getSettings.mockImplementation(() => new Promise(() => {}));

    render(<Settings />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should load and display settings successfully', async () => {
    mockSettingsApi.getSettings.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Platform Preferences')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Integrations')).toBeInTheDocument();
    });

    expect(mockSettingsApi.getSettings).toHaveBeenCalledTimes(1);
  });

  it('should display error when settings fail to load', async () => {
    mockSettingsApi.getSettings.mockResolvedValue({
      success: false,
      error: 'Failed to load settings'
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load settings')).toBeInTheDocument();
    });
  });

  it('should handle settings update successfully', async () => {
    mockSettingsApi.getSettings.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    const updatedSettings = { ...mockSettings, timezone: 'America/New_York' };
    mockSettingsApi.updateSettings.mockResolvedValue({
      success: true,
      settings: updatedSettings
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByTestId('general-settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Settings'));

    await waitFor(() => {
      expect(screen.getByText('Settings updated successfully')).toBeInTheDocument();
    });

    expect(mockSettingsApi.updateSettings).toHaveBeenCalledWith({
      timezone: 'America/New_York'
    });
  });

  it('should handle platform preferences update successfully', async () => {
    mockSettingsApi.getSettings.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    mockSettingsApi.updatePlatformPreferences.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Platform Preferences')).toBeInTheDocument();
    });

    // Switch to platform preferences tab
    fireEvent.click(screen.getByText('Platform Preferences'));

    await waitFor(() => {
      expect(screen.getByTestId('platform-settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Platform'));

    await waitFor(() => {
      expect(screen.getByText('Platform preferences updated successfully')).toBeInTheDocument();
    });

    expect(mockSettingsApi.updatePlatformPreferences).toHaveBeenCalledWith({
      facebook: { autoPost: true }
    });
  });

  it('should handle notification settings update successfully', async () => {
    mockSettingsApi.getSettings.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    mockSettingsApi.updateNotificationSettings.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    // Switch to notifications tab
    fireEvent.click(screen.getByText('Notifications'));

    await waitFor(() => {
      expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Notifications'));

    await waitFor(() => {
      expect(screen.getByText('Notification settings updated successfully')).toBeInTheDocument();
    });

    expect(mockSettingsApi.updateNotificationSettings).toHaveBeenCalledWith({
      emailNotifications: false
    });
  });

  it('should handle settings reset successfully', async () => {
    mockSettingsApi.getSettings.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    const defaultSettings = { ...mockSettings, timezone: 'UTC', defaultHashtags: [] };
    mockSettingsApi.resetSettings.mockResolvedValue({
      success: true,
      settings: defaultSettings
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByTestId('general-settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Reset Settings'));

    await waitFor(() => {
      expect(screen.getByText('Settings reset to defaults successfully')).toBeInTheDocument();
    });

    expect(mockSettingsApi.resetSettings).toHaveBeenCalledTimes(1);
  });

  it('should handle API errors gracefully', async () => {
    mockSettingsApi.getSettings.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    mockSettingsApi.updateSettings.mockResolvedValue({
      success: false,
      error: 'Update failed'
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByTestId('general-settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Settings'));

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });

  it('should switch between tabs correctly', async () => {
    mockSettingsApi.getSettings.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByTestId('general-settings')).toBeInTheDocument();
    });

    // Switch to platform preferences tab
    fireEvent.click(screen.getByText('Platform Preferences'));
    expect(screen.getByTestId('platform-settings')).toBeInTheDocument();

    // Switch to notifications tab
    fireEvent.click(screen.getByText('Notifications'));
    expect(screen.getByTestId('notification-settings')).toBeInTheDocument();

    // Switch to integrations tab
    fireEvent.click(screen.getByText('Integrations'));
    expect(screen.getByTestId('integration-settings')).toBeInTheDocument();
  });

  it('should clear success messages after timeout', async () => {
    vi.useFakeTimers();

    mockSettingsApi.getSettings.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    mockSettingsApi.updateSettings.mockResolvedValue({
      success: true,
      settings: mockSettings
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByTestId('general-settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Settings'));

    await waitFor(() => {
      expect(screen.getByText('Settings updated successfully')).toBeInTheDocument();
    });

    // Fast forward 3 seconds
    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.queryByText('Settings updated successfully')).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});