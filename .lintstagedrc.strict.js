module.exports = {
  // TypeScript and TSX files
  '*.{ts,tsx}': (filenames) => {
    const commands = [];

    // Always run Prettier for formatting consistency
    commands.push(`prettier --write ${filenames.join(' ')}`);

    // Run TypeScript type checking on the entire project
    // This ensures type safety across file boundaries
    commands.push('tsc --noEmit');

    // Run ESLint with auto-fix
    // Using --max-warnings 0 only on changed files to prevent new issues
    commands.push(`eslint --fix --max-warnings 0 ${filenames.join(' ')}`);

    return commands;
  },

  // JavaScript files (if any)
  '*.{js,jsx}': (filenames) => [
    `prettier --write ${filenames.join(' ')}`,
    `eslint --fix --max-warnings 0 ${filenames.join(' ')}`,
  ],

  // JSON, Markdown, and other files
  '*.{json,md,mdx}': (filenames) => [`prettier --write ${filenames.join(' ')}`],

  // CSS and style files
  '*.{css,scss,sass}': (filenames) => [`prettier --write ${filenames.join(' ')}`],

  // Run tests related to changed files
  '*.{test,spec}.{ts,tsx,js,jsx}': (filenames) => [
    'jest --bail --findRelatedTests --passWithNoTests',
  ],
};
