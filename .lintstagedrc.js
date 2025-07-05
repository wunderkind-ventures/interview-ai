// Gradual adoption configuration - Start with formatting only
// Then progressively enable more strict checks
module.exports = {
  // Stage 1: Format all files (current)
  '*.{ts,tsx,js,jsx,json,md,mdx,css,scss}': (filenames) => [
    `prettier --write ${filenames.join(' ')}`,
  ],

  // Stage 2: Add type checking (uncomment when ready)
  // '*.{ts,tsx}': () => ['tsc --noEmit'],

  // Stage 3: Add ESLint for new issues only (uncomment when ready)
  // '*.{ts,tsx,js,jsx}': (filenames) => [
  //   `eslint --fix --max-warnings 0 ${filenames.join(' ')}`
  // ],

  // Stage 4: Add tests for test files (uncomment when ready)
  // '*.{test,spec}.{ts,tsx,js,jsx}': () => [
  //   'jest --bail --findRelatedTests --passWithNoTests'
  // ],

  // Stage 5: Full strict mode (use .lintstagedrc.js)
};
