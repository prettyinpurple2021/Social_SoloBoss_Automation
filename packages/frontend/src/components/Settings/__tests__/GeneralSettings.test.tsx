import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { GeneralSettings } from '../GeneralSettings';
import { UserSettings } from '../../../types/user';

describe('GeneralSettings', () => {
  const mockSettings: UserSettings = {
    timezone: 'UTC',
    defaultHashtags: ['test', 'example'],
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

  const mockOnUpdate = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render general settings correctly', () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByText('General Settings')).toBeInTheDocument();
    expect(screen.getByText('Timezone')).toBeInTheDocument();
    expect(screen.getByText('Default Hashtags')).toBeInTheDocument();
    expect(screen.getByDisplayValue('UTC')).toBeInTheDocument();
  });

  it('should display existing hashtags', () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByText('#test')).toBeInTheDocument();
    expect(screen.getByText('#example')).toBeInTheDocument();
  });

  it('should handle timezone change', () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    const timezoneSelect = screen.getByDisplayValue('UTC');
    fireEvent.mouseDown(timezoneSelect);
    
    const newTimezoneOption = screen.getByText('America/New_York');
    fireEvent.click(newTimezoneOption);

    expect(mockOnUpdate).toHaveBeenCalledWith({ timezone: 'America/New_York' });
  });

  it('should add new hashtag', () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    const hashtagInput = screen.getByPlaceholderText('Enter hashtag without #');
    const addButton = screen.getByText('Add');

    fireEvent.change(hashtagInput, { target: { value: 'newhashtag' } });
    fireEvent.click(addButton);

    expect(mockOnUpdate).toHaveBeenCalledWith({
      defaultHashtags: ['test', 'example', 'newhashtag']
    });
  });

  it('should add hashtag on Enter key press', () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    const hashtagInput = screen.getByPlaceholderText('Enter hashtag without #');

    fireEvent.change(hashtagInput, { target: { value: 'enterhashtag' } });
    fireEvent.keyPress(hashtagInput, { key: 'Enter', code: 'Enter' });

    expect(mockOnUpdate).toHaveBeenCalledWith({
      defaultHashtags: ['test', 'example', 'enterhashtag']
    });
  });

  it('should not add duplicate hashtags', () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    const hashtagInput = screen.getByPlaceholderText('Enter hashtag without #');
    const addButton = screen.getByText('Add');

    fireEvent.change(hashtagInput, { target: { value: 'test' } });
    fireEvent.click(addButton);

    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it('should not add empty hashtags', () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    const hashtagInput = screen.getByPlaceholderText('Enter hashtag without #');
    const addButton = screen.getByText('Add');

    fireEvent.change(hashtagInput, { target: { value: '   ' } });
    fireEvent.click(addButton);

    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it('should remove hashtag', () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    const testHashtagChip = screen.getByText('#test').closest('.MuiChip-root');
    const deleteButton = testHashtagChip?.querySelector('[data-testid="CancelIcon"]');
    
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }

    expect(mockOnUpdate).toHaveBeenCalledWith({
      defaultHashtags: ['example']
    });
  });

  it('should show reset confirmation dialog', async () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    const resetButton = screen.getByText('Reset to Defaults');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByText('Reset Settings')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to reset all settings/)).toBeInTheDocument();
    });
  });

  it('should handle reset confirmation', async () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    const resetButton = screen.getByText('Reset to Defaults');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByText('Reset Settings')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: 'Reset' });
    fireEvent.click(confirmButton);

    expect(mockOnReset).toHaveBeenCalledTimes(1);
  });

  it('should handle reset cancellation', async () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    const resetButton = screen.getByText('Reset to Defaults');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByText('Reset Settings')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Reset Settings')).not.toBeInTheDocument();
    });

    expect(mockOnReset).not.toHaveBeenCalled();
  });

  it('should display message when no hashtags are set', () => {
    const settingsWithoutHashtags = {
      ...mockSettings,
      defaultHashtags: []
    };

    render(
      <GeneralSettings
        settings={settingsWithoutHashtags}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByText('No default hashtags set')).toBeInTheDocument();
  });

  it('should disable add button when input is empty', () => {
    render(
      <GeneralSettings
        settings={mockSettings}
        onUpdate={mockOnUpdate}
        onReset={mockOnReset}
      />
    );

    const addButton = screen.getByText('Add');
    expect(addButton).toBeDisabled();

    const hashtagInput = screen.getByPlaceholderText('Enter hashtag without #');
    fireEvent.change(hashtagInput, { target: { value: 'test' } });

    expect(addButton).not.toBeDisabled();
  });
});