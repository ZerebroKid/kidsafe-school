/**
 * Jest config for `@zerebro/functions`. Uses ts-jest in `isolatedModules`
 * mode so the test runner doesn't pay tsc's full type-check cost on every
 * run (we already have `pnpm typecheck` for that). Test files live under
 * `src/**\/__tests__/*.test.ts` so they're tree-shaken out of the deploy
 * (Cloud Build only copies what `tsc` emits to `dist/`, which by default
 * includes everything; we exclude `__tests__` from emit via tsconfig
 * if needed -- not done today because the test runner is the only consumer
 * and the resulting JS in dist is harmless dead code).
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  clearMocks: true,
  testTimeout: 15000,
};
