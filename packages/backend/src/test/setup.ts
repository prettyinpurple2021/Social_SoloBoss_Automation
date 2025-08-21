import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

// Mock database for testing
const mockDb = {
  query: jest.fn(),
  runMigrations: jest.fn(),
  close: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue(true),
  transaction: jest.fn(),
  getClient: jest.fn()
};

jest.mock('../database/connection', () => ({
  db: mockDb
}));

// Export testDb for use in tests
export const testDb = mockDb;

// Helper function to clean up test data (mocked)
export async function cleanupTestData() {
  // This is mocked, so no actual cleanup needed
}