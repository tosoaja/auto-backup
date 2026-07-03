module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/*.test.js',
    '**/*.spec.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    'modules/**/*.js',
    '!src/**/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  verbose: true,
  testTimeout: 10000
};
