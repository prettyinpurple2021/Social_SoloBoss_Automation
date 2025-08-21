import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { PostForm } from '../PostForm';
import { Platform } from '@sma/shared/types/platform';
import { PostData } from '@sma/shared/types/post';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </LocalizationProvider>
  );
};

const mockOnSubmit = vi.fn();
const mockOnClose = vi.fn();

const defaultProps = {
  open: true,
  onClose: mockOnClose,
  onSubmit: mockOnSubmit
};

describe('PostForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create post form when open', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    expect(screen.getByText('Create New Post')).toBeInTheDocument();
    expect(screen.getByLabelText('Post Content')).toBeInTheDocument();
  });

  it('renders edit post form with initial data', () => {
    const initialData: Partial<PostData> = {
      content: 'Test content',
      platforms: [Platform.FACEBOOK],
      hashtags: ['#test']
    };

    renderWithProviders(
      <PostForm {...defaultProps} initialData={initialData} />
    );

    expect(screen.getByText('Edit Post')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test content')).toBeInTheDocument();
    expect(screen.getByText('#test')).toBeInTheDocument();
  });

  it('allows typing in content field', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const contentField = screen.getByLabelText('Post Content');
    fireEvent.change(contentField, { target: { value: 'New post content' } });

    expect(screen.getByDisplayValue('New post content')).toBeInTheDocument();
  });

  it('allows selecting platforms', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const facebookCheckbox = screen.getByRole('checkbox', { name: /Facebook Business Page/ });
    fireEvent.click(facebookCheckbox);

    expect(facebookCheckbox).toBeChecked();
  });

  it('shows character count for selected platforms', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const contentField = screen.getByLabelText('Post Content');
    fireEvent.change(contentField, { target: { value: 'Test content' } });

    const facebookCheckbox = screen.getByRole('checkbox', { name: /Facebook Business Page/ });
    fireEvent.click(facebookCheckbox);

    expect(screen.getByText(/12\/63206 characters/)).toBeInTheDocument();
  });

  it('allows adding hashtags', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const hashtagField = screen.getByPlaceholderText('Add hashtag');
    fireEvent.change(hashtagField, { target: { value: 'test' } });

    const addButton = screen.getByRole('button', { name: 'Add hashtag' });
    fireEvent.click(addButton);

    expect(screen.getByText('#test')).toBeInTheDocument();
  });

  it('allows removing hashtags', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const hashtagField = screen.getByPlaceholderText('Add hashtag');
    fireEvent.change(hashtagField, { target: { value: 'test' } });

    const addButton = screen.getByRole('button', { name: 'Add hashtag' });
    fireEvent.click(addButton);

    const deleteButton = screen.getByLabelText('delete');
    fireEvent.click(deleteButton);

    expect(screen.queryByText('#test')).not.toBeInTheDocument();
  });

  it('adds hashtag on Enter key press', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const hashtagField = screen.getByPlaceholderText('Add hashtag');
    fireEvent.change(hashtagField, { target: { value: 'test' } });
    fireEvent.keyPress(hashtagField, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText('#test')).toBeInTheDocument();
  });

  it('automatically adds # to hashtags', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const hashtagField = screen.getByPlaceholderText('Add hashtag');
    fireEvent.change(hashtagField, { target: { value: 'test' } });

    const addButton = screen.getByRole('button', { name: 'Add hashtag' });
    fireEvent.click(addButton);

    expect(screen.getByText('#test')).toBeInTheDocument();
  });

  it('enables scheduling when checkbox is checked', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const scheduleCheckbox = screen.getByRole('checkbox', { name: 'Schedule for later' });
    fireEvent.click(scheduleCheckbox);

    expect(screen.getByLabelText('Scheduled Time')).toBeInTheDocument();
  });

  it('disables submit button when form is invalid', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const submitButton = screen.getByText('Post Now');
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when form is valid', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const contentField = screen.getByLabelText('Post Content');
    fireEvent.change(contentField, { target: { value: 'Test content' } });

    const facebookCheckbox = screen.getByRole('checkbox', { name: /Facebook Business Page/ });
    fireEvent.click(facebookCheckbox);

    const submitButton = screen.getByText('Post Now');
    expect(submitButton).not.toBeDisabled();
  });

  it('calls onSubmit with correct data when form is submitted', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const contentField = screen.getByLabelText('Post Content');
    fireEvent.change(contentField, { target: { value: 'Test content' } });

    const facebookCheckbox = screen.getByRole('checkbox', { name: /Facebook Business Page/ });
    fireEvent.click(facebookCheckbox);

    const submitButton = screen.getByText('Post Now');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      userId: 'current-user',
      platforms: [Platform.FACEBOOK],
      content: 'Test content',
      hashtags: [],
      scheduledTime: undefined
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows character limit warning', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    // Create content that's close to X's character limit
    const longContent = 'a'.repeat(250);
    const contentField = screen.getByLabelText('Post Content');
    fireEvent.change(contentField, { target: { value: longContent } });

    const xCheckbox = screen.getByRole('checkbox', { name: /X \(formerly Twitter\)/ });
    fireEvent.click(xCheckbox);

    expect(screen.getByText('Some platforms are approaching or exceeding character limits. Consider shortening your content.')).toBeInTheDocument();
  });

  it('changes submit button text when scheduling is enabled', () => {
    renderWithProviders(<PostForm {...defaultProps} />);

    const contentField = screen.getByLabelText('Post Content');
    fireEvent.change(contentField, { target: { value: 'Test content' } });

    const facebookCheckbox = screen.getByRole('checkbox', { name: /Facebook Business Page/ });
    fireEvent.click(facebookCheckbox);

    const scheduleCheckbox = screen.getByRole('checkbox', { name: 'Schedule for later' });
    fireEvent.click(scheduleCheckbox);

    expect(screen.getByText('Schedule Post')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderWithProviders(<PostForm {...defaultProps} open={false} />);

    expect(screen.queryByText('Create New Post')).not.toBeInTheDocument();
  });
});