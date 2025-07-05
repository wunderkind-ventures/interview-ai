module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-explicit-any': 'warn', // Allow any but warn (will fix gradually)
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/ban-ts-comment': [
      'warn',
      {
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': 'allow-with-description',
        'ts-nocheck': 'allow-with-description',
        'ts-check': false,
      },
    ],

    // React rules
    'react/no-unescaped-entities': 'off', // Allow quotes in JSX
    'react-hooks/exhaustive-deps': 'warn', // Warn instead of error for missing deps

    // Import rules
    'import/no-anonymous-default-export': 'off', // Allow anonymous exports

    // General JavaScript rules
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'warn',
    'no-alert': 'warn',

    // Next.js specific
    '@next/next/no-img-element': 'off', // Allow img element (we'll use Next Image when appropriate)
  },
  overrides: [
    {
      // Test files
      files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    {
      // Configuration files
      files: ['*.config.js', '*.config.ts', 'scripts/**/*'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      // AI/Agent files with decorators
      files: ['src/agents/**/*', 'src/ai/**/*'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off', // AI responses can be dynamic
        '@typescript-eslint/ban-ts-comment': 'off', // May need TS directives for decorators
      },
    },
    {
      // UI Components
      files: ['src/components/ui/**/*'],
      rules: {
        'react/display-name': 'off', // forwardRef components
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    'public/',
    'coverage/',
    '*.min.js',
    'debugging/',
    '__mocks__/',
  ],
};
