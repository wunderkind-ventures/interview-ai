const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Module name mapper for handling CSS imports (CSS modules)
  moduleNameMapper: {
    // Handle CSS imports (CSS modules)
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',

    // Handle CSS imports (without CSS modules)
    '^.+\\.(css|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',

    // Handle image imports
    '^.+\\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/i': '<rootDir>/__mocks__/fileMock.js',

    // Handle module aliases
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Test environment
  testEnvironment: 'jest-environment-jsdom',

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/app/api/**',
    '!src/ai/**', // Skip AI flows for now
    '!src/lib/firebase.ts',
    '!src/agents/**', // Skip agents with decorators
    '!src/testing/**', // Skip testing utilities
    '!src/**/__tests__/**', // Skip test files
  ],

  // Test path ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/debugging/',
    // Temporarily ignore tests with decorator issues
    '<rootDir>/src/agents/__tests__/',
    '<rootDir>/src/testing/__tests__/',
    '<rootDir>/src/components/__tests__/save-status-indicator.test.tsx',
    '<rootDir>/src/components/__tests__/session-timer.test.tsx',
  ],

  // Transform ignore patterns
  transformIgnorePatterns: ['node_modules/(?!(uuid|nanoid|lucide-react)/)'],

  // Globals for TypeScript
  globals: {
    'ts-jest': {
      tsconfig: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },

  // Coverage thresholds (start at 0, increase over time)
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
