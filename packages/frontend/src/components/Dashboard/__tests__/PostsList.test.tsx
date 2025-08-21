import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PostsList } from '../PostsList';
import { Post, PostStatus, PostSource } from '@sma/shared/types/post';
import { Platform } from '@sma/shared/types/platform';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockPost: Post = {
  id: '1',
  userId: 'user1',
  content: 'Test post content',
  images: [],
  hashtags: ['#test', '#automation'],
  platforms: [Platform.FACEBOOK, Platform.X],
  scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
  status: PostStatus.SCHEDULED,
  source: PostSource.MANUAL,
  platformPosts: [
    {
      platform: Platform.FACEBOOK,
      content: 'Test post content',
      status: PostStatus.SCHEDULED
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('PostsList', () => {
  it('displays empty state when no posts provided', () => {
    renderWithTheme(<PostsList posts={[]} />);
    
    expect(screen.getByText('No posts yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first post to get started with social media automation')).toBeInTheDocument();
  });

  it('displays posts when provided', () => {
    renderWithTheme(<PostsList posts={[mockPost]} />);
    
    expect(screen.getByText('Your Posts')).toBeInTheDocument();
    expect(screen.getByText('Test post content')).toBeInTheDocument();
  });

  it('shows post status correctly', () => {
    renderWithTheme(<PostsList posts={[mockPost]} />);
    
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('displays hashtags', () => {
    renderWithTheme(<PostsList posts={[mockPost]} />);
    
    expect(screen.getByText('#test')).toBeInTheDocument();
    expect(screen.getByText('#automation')).toBeInTheDocument();
  });

  it('shows platform icons', () => {
    renderWithTheme(<PostsList posts={[mockPost]} />);
    
    // Check that platform icons are rendered (Facebook and X icons)
    expect(screen.getByTestId('FacebookIcon')).toBeInTheDocument();
    expect(screen.getByTestId('XIcon')).toBeInTheDocument();
  });

  it('opens menu when more options button is clicked', () => {
    const mockOnEdit = vi.fn();
    const mockOnDelete = vi.fn();
    
    renderWithTheme(
      <PostsList 
        posts={[mockPost]} 
        onEditPost={mockOnEdit}
        onDeletePost={mockOnDelete}
      />
    );
    
    const moreButton = screen.getByTestId('MoreVertIcon').closest('button')!;
    fireEvent.click(moreButton);
    
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onEditPost when edit is clicked', () => {
    const mockOnEdit = vi.fn();
    
    renderWithTheme(
      <PostsList 
        posts={[mockPost]} 
        onEditPost={mockOnEdit}
      />
    );
    
    const moreButton = screen.getByTestId('MoreVertIcon').closest('button')!;
    fireEvent.click(moreButton);
    
    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);
    
    expect(mockOnEdit).toHaveBeenCalledWith(mockPost);
  });

  it('calls onDeletePost when delete is clicked', () => {
    const mockOnDelete = vi.fn();
    
    renderWithTheme(
      <PostsList 
        posts={[mockPost]} 
        onDeletePost={mockOnDelete}
      />
    );
    
    const moreButton = screen.getByTestId('MoreVertIcon').closest('button')!;
    fireEvent.click(moreButton);
    
    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);
    
    expect(mockOnDelete).toHaveBeenCalledWith('1');
  });

  it('truncates long content', () => {
    const longPost = {
      ...mockPost,
      content: 'This is a very long post content that should be truncated when displayed in the posts list because it exceeds the maximum length that we want to show in the card view'
    };
    
    renderWithTheme(<PostsList posts={[longPost]} />);
    
    expect(screen.getByText(/This is a very long post content that should be truncated when displayed in the posts list because it exceeds the maximum length that we want to show .../)).toBeInTheDocument();
  });

  it('displays scheduled time for scheduled posts', () => {
    renderWithTheme(<PostsList posts={[mockPost]} />);
    
    expect(screen.getByText(/Scheduled for/)).toBeInTheDocument();
  });

  it('displays error message for failed posts', () => {
    const failedPost = {
      ...mockPost,
      status: PostStatus.FAILED,
      platformPosts: [
        {
          platform: Platform.FACEBOOK,
          content: 'Test post content',
          status: PostStatus.FAILED,
          error: 'Rate limit exceeded'
        }
      ]
    };
    
    renderWithTheme(<PostsList posts={[failedPost]} />);
    
    expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
  });
});