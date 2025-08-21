# Testing Guide - Social Media Automation Platform

## Overview

This document provides comprehensive information about the testing strategy, setup, and execution for the Social Media Automation Platform. The testing suite includes unit tests, integration tests, end-to-end tests, and performance tests.

## Testing Architecture

### Test Types

1. **Unit Tests**: Test individual functions and components in isolation
2. **Integration Tests**: Test interactions between different modules and services
3. **End-to-End Tests**: Test complete user workflows from frontend to backend
4. **Performance Tests**: Test system performance under load
5. **Security Tests**: Test for security vulnerabilities and compliance

### Test Structure

```
packages/
├── backend/
│   └── src/
│       └── test/
│           ├── unit/           # Unit tests
│           ├── integration/    # Integration tests
│           ├── e2e/           # End-to-end tests
│           ├── performance/   # Performance tests
│           ├── mocks/         # Mock data and services
│           └── setup.ts       # Test setup configuration
├── frontend/
│   └── src/
│       └── test/
│           ├── components/    # Component tests
│           ├── e2e/          # End-to-end tests
│           ├── utils/        # Utility function tests
│           └── setup.ts      # Test setup configuration
└── shared/
    └── src/
        └── __tests__/        # Shared package tests
```

## Backend Testing

### Setup

The backend uses Jest as the testing framework with the following configuration:

```javascript
// packages/backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: ['/e2e/', '/performance/']
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/src/test/e2e/**/*.test.ts'],
      testTimeout: 60000
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/test/performance/**/*.test.ts'],
      testTimeout: 120000
    }
  ]
};
```

### Running Tests

```bash
# Run all tests
npm run test --workspace=packages/backend

# Run only unit tests
npm run test --workspace=packages/backend -- --selectProjects unit

# Run end-to-end tests
npm run test:e2e --workspace=packages/backend

# Run performance tests
npm run test:performance --workspace=packages/backend

# Run tests with coverage
npm run test:coverage --workspace=packages/backend

# Run tests in watch mode
npm run test:watch --workspace=packages/backend
```

### Unit Tests

Unit tests focus on testing individual functions, classes, and modules in isolation.

**Example Unit Test:**
```typescript
// packages/backend/src/services/__tests__/AuthService.test.ts
import { AuthService } from '../AuthService';
import { DatabaseConnection } from '../../database/connection';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'testPassword123!';
      const hashedPassword = await authService.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123!';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123!';
      const hashedPassword = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword123!';
      const hashedPassword = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });
  });
});
```

### Integration Tests

Integration tests verify that different parts of the system work together correctly.

**Example Integration Test:**
```typescript
// packages/backend/src/test/integration/post-creation.test.ts
import request from 'supertest';
import { app } from '../../index';
import { DatabaseConnection } from '../../database/connection';

describe('Post Creation Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    await DatabaseConnection.initialize();
    
    // Create test user and get auth token
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User'
      });
    
    authToken = response.body.token;
  });

  afterAll(async () => {
    await DatabaseConnection.close();
  });

  it('should create post and store in database', async () => {
    const postData = {
      content: 'Test post content',
      platforms: ['facebook'],
      hashtags: ['#test']
    };

    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send(postData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.content).toBe(postData.content);
    expect(response.body.status).toBe('draft');

    // Verify post exists in database
    const dbPost = await DatabaseConnection.query(
      'SELECT * FROM posts WHERE id = $1',
      [response.body.id]
    );
    
    expect(dbPost.rows).toHaveLength(1);
    expect(dbPost.rows[0].content).toBe(postData.content);
  });
});
```

### End-to-End Tests

End-to-end tests simulate complete user workflows from registration to post publishing.

**Key Features Tested:**
- User registration and authentication
- Platform OAuth connections
- Post creation and scheduling
- Blogger integration workflows
- SoloBoss integration workflows
- Error handling and recovery

### Performance Tests

Performance tests ensure the system can handle expected load and identify bottlenecks.

**Test Scenarios:**
- Concurrent user registration and login
- High-volume post creation and scheduling
- Database query performance under load
- Memory usage and leak detection
- API response time benchmarks

**Example Performance Test:**
```typescript
// packages/backend/src/test/performance/load-testing.perf.test.ts
describe('High-Volume Post Scheduling', () => {
  it('should handle concurrent post creation from multiple users', async () => {
    const NUM_USERS = 50;
    const POSTS_PER_USER = 5;
    
    const startTime = performance.now();
    const promises: Promise<any>[] = [];

    for (let userIndex = 0; userIndex < NUM_USERS; userIndex++) {
      for (let postIndex = 0; postIndex < POSTS_PER_USER; postIndex++) {
        const promise = request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          .send({
            content: `Load test post ${postIndex} from user ${userIndex}`,
            platforms: ['facebook'],
            hashtags: ['#loadtest']
          });
        
        promises.push(promise);
      }
    }

    const results = await Promise.allSettled(promises);
    const endTime = performance.now();
    
    const successfulRequests = results.filter(
      r => r.status === 'fulfilled' && r.value.status === 201
    );
    
    // Performance assertions
    expect(successfulRequests.length).toBeGreaterThan(promises.length * 0.95);
    expect(endTime - startTime).toBeLessThan(30000); // Complete within 30 seconds
    expect((endTime - startTime) / promises.length).toBeLessThan(1000); // < 1s per request
  });
});
```

## Frontend Testing

### Setup

The frontend uses Vitest as the testing framework with React Testing Library:

```typescript
// packages/frontend/vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
```

### Running Tests

```bash
# Run all frontend tests
npm run test --workspace=packages/frontend

# Run tests in watch mode
npm run test:watch --workspace=packages/frontend

# Run end-to-end tests
npm run test:e2e --workspace=packages/frontend

# Run tests with coverage
npm run test:coverage --workspace=packages/frontend
```

### Component Tests

Component tests verify that React components render correctly and handle user interactions.

**Example Component Test:**
```typescript
// packages/frontend/src/components/__tests__/PostForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostForm } from '../PostForm';

describe('PostForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('should render form fields correctly', () => {
    render(<PostForm onSubmit={mockOnSubmit} />);
    
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hashtags/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/facebook/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create post/i })).toBeInTheDocument();
  });

  it('should submit form with correct data', async () => {
    const user = userEvent.setup();
    render(<PostForm onSubmit={mockOnSubmit} />);
    
    const contentInput = screen.getByLabelText(/content/i);
    const hashtagsInput = screen.getByLabelText(/hashtags/i);
    const facebookCheckbox = screen.getByLabelText(/facebook/i);
    const submitButton = screen.getByRole('button', { name: /create post/i });

    await user.type(contentInput, 'Test post content');
    await user.type(hashtagsInput, '#test #automation');
    await user.click(facebookCheckbox);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        content: 'Test post content',
        hashtags: ['#test', '#automation'],
        platforms: ['facebook']
      });
    });
  });

  it('should show validation errors for empty content', async () => {
    const user = userEvent.setup();
    render(<PostForm onSubmit={mockOnSubmit} />);
    
    const submitButton = screen.getByRole('button', { name: /create post/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/content is required/i)).toBeInTheDocument();
    });
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
```

### Frontend End-to-End Tests

Frontend E2E tests simulate complete user interactions with the application.

**Test Coverage:**
- User registration and login flows
- Post creation and editing workflows
- Dashboard navigation and functionality
- Settings management
- Error handling and user feedback

## Test Data Management

### Mock Data

Mock data is centralized and reusable across tests:

```typescript
// packages/backend/src/test/mocks/data.ts
export const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-15T10:30:00Z'
};

export const mockPost = {
  id: 'post-123',
  content: 'Test post content',
  platforms: ['facebook'],
  status: 'draft',
  hashtags: ['#test'],
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-15T10:30:00Z'
};

export const mockPlatformConnection = {
  id: 'conn-123',
  platform: 'facebook',
  platformUserId: 'fb-123456',
  platformUsername: 'testuser',
  isActive: true,
  createdAt: '2024-01-15T10:30:00Z'
};
```

### Database Seeding

Test databases are seeded with consistent data for integration tests:

```typescript
// packages/backend/src/test/utils/seedDatabase.ts
export async function seedTestDatabase() {
  // Clear existing data
  await DatabaseConnection.query('TRUNCATE TABLE users, posts, platform_connections CASCADE');
  
  // Insert test users
  const users = await DatabaseConnection.query(`
    INSERT INTO users (id, email, name, password_hash)
    VALUES 
      ('${mockUser.id}', '${mockUser.email}', '${mockUser.name}', '$2b$10$hashedpassword'),
      ('user-2', 'user2@example.com', 'User Two', '$2b$10$hashedpassword2')
    RETURNING *
  `);
  
  // Insert test posts
  await DatabaseConnection.query(`
    INSERT INTO posts (id, user_id, content, platforms, status)
    VALUES 
      ('${mockPost.id}', '${mockUser.id}', '${mockPost.content}', ARRAY['facebook'], 'draft')
  `);
  
  return { users: users.rows };
}
```

## Continuous Integration

### GitHub Actions Workflow

The CI pipeline runs comprehensive tests on every push and pull request:

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_USER: test_user
          POSTGRES_DB: sma_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build --workspace=packages/shared
      - run: npm run test --workspace=packages/backend
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/sma_test
          REDIS_URL: redis://localhost:6379
```

### Test Environments

Different test environments are configured for different test types:

1. **Unit Test Environment**: Minimal setup with mocked dependencies
2. **Integration Test Environment**: Real database and Redis instances
3. **E2E Test Environment**: Full application stack running
4. **Performance Test Environment**: Production-like configuration with monitoring

## Coverage Requirements

### Coverage Targets

- **Unit Tests**: Minimum 90% code coverage
- **Integration Tests**: Minimum 80% feature coverage
- **E2E Tests**: 100% critical user journey coverage

### Coverage Reports

Coverage reports are generated automatically and include:

- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

```bash
# Generate coverage report
npm run test:coverage --workspace=packages/backend

# View coverage report
open packages/backend/coverage/lcov-report/index.html
```

## Best Practices

### Test Organization

1. **Descriptive Test Names**: Use clear, descriptive test names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and assertion phases
3. **Single Responsibility**: Each test should verify one specific behavior
4. **Independent Tests**: Tests should not depend on each other or external state

### Mock Strategy

1. **Mock External Dependencies**: Always mock external APIs and services
2. **Use Real Database for Integration Tests**: Use actual database instances for integration tests
3. **Consistent Mock Data**: Use centralized mock data for consistency
4. **Mock at the Right Level**: Mock at the boundary of your system under test

### Performance Testing

1. **Realistic Load**: Use realistic user loads and data volumes
2. **Baseline Metrics**: Establish baseline performance metrics
3. **Continuous Monitoring**: Run performance tests regularly to catch regressions
4. **Resource Monitoring**: Monitor CPU, memory, and database performance

### Error Testing

1. **Test Error Paths**: Ensure error handling code is tested
2. **Network Failures**: Test behavior when external services are unavailable
3. **Invalid Input**: Test with malformed and invalid input data
4. **Edge Cases**: Test boundary conditions and edge cases

## Debugging Tests

### Common Issues

1. **Async Test Failures**: Ensure proper async/await usage and timeouts
2. **Database State**: Clean up database state between tests
3. **Mock Leakage**: Reset mocks between tests to avoid interference
4. **Timing Issues**: Use proper waiting mechanisms for async operations

### Debugging Tools

```bash
# Run specific test file
npm test -- --testNamePattern="AuthService"

# Run tests with verbose output
npm test -- --verbose

# Run tests in debug mode
npm test -- --runInBand --detectOpenHandles

# Run single test with debugging
npm test -- --testNamePattern="should hash password correctly" --runInBand
```

### Test Debugging Tips

1. **Use `console.log`**: Add temporary logging to understand test flow
2. **Check Test Data**: Verify mock data and database state
3. **Isolate Tests**: Run individual tests to isolate issues
4. **Check Async Operations**: Ensure all promises are properly awaited

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Keep testing dependencies up to date
2. **Review Coverage**: Regularly review and improve test coverage
3. **Performance Baselines**: Update performance baselines as system evolves
4. **Mock Data**: Keep mock data synchronized with real data structures

### Test Refactoring

1. **Remove Duplicate Code**: Extract common test setup into utilities
2. **Update Obsolete Tests**: Remove or update tests for deprecated features
3. **Improve Test Performance**: Optimize slow-running tests
4. **Enhance Readability**: Improve test clarity and documentation

This testing guide provides comprehensive coverage of the testing strategy and implementation for the Social Media Automation Platform. Regular updates to this guide ensure it remains current with the evolving codebase and testing practices.