import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import App from '../../App';

// Mock API responses
const mockApiResponses = {
  register: {
    token: 'mock-jwt-token',
    user: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    }
  },
  login: {
    token: 'mock-jwt-token',
    user: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test User'
    }
  },
  posts: {
    posts: [
      {
        id: 'post-1',
        content: 'Test post content',
        platforms: ['facebook'],
        status: 'scheduled',
        scheduledTime: '2024-01-20T15:30:00Z',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z'
      }
    ],
    totalCount: 1,
    page: 1,
    limit: 20,
    totalPages: 1
  }
};

// Mock fetch globally
global.fetch = vi.fn();

const mockFetch = (url: string, options?: any) => {
  const method = options?.method || 'GET';

  if (url.includes('/auth/register') && method === 'POST') {
    return Promise.resolve({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockApiResponses.register)
    });
  }

  if (url.includes('/auth/login') && method === 'POST') {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockApiResponses.login)
    });
  }

  if (url.includes('/posts') && method === 'GET') {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockApiResponses.posts)
    });
  }

  return Promise.resolve({
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: 'Not found' })
  });
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('End-to-End User Workflows', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(mockFetch as any);
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle user registration workflow', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    );

    // Should see login form initially
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();

    // Navigate to registration
    const registerLink = screen.getByText(/sign up/i);
    await user.click(registerLink);

    // Fill registration form
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const registerButton = screen.getByRole('button', { name: /register/i });

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'SecurePassword123!');
    await user.click(registerButton);

    // Should redirect to dashboard
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });
  });

  it('should handle login workflow', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'SecurePassword123!');
    await user.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });
  });
});