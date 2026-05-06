/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: false, esModuleInterop: true } }],
  },
  setupFiles: ['<rootDir>/__tests__/helpers/setup.ts'],
  clearMocks: true,
  collectCoverageFrom: [
    'Controllers/**/*.ts',
    'Services/**/*.ts',
    'middleware/**/*.ts',
    '!**/node_modules/**',
  ],
  coverageReporters: ['text', 'lcov'],
};
