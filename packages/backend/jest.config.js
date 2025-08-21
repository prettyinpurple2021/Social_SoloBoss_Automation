module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/test/**/*.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@sma/shared$': '<rootDir>/../shared/src',
  },
  testTimeout: 30000,
  maxWorkers: 1,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: ['/e2e/', '/performance/'],
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/src/test/e2e/**/*.test.ts'],
      testTimeout: 60000,
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/test/performance/**/*.test.ts'],
      testTimeout: 120000,
    },
  ],
};