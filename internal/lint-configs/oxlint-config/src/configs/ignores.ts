import type { OxlintConfig } from 'oxlint';

const ignores: OxlintConfig = {
  ignorePatterns: [
    '**/dist/**',
    '**/node_modules/**',
    'docs/**',
    'libraries/**',
    'playground/public/**',
    '**/*.json',
    '**/*.md',
    '**/*.svg',
    '**/*.yaml',
    '**/*.yml',
  ],
};

export { ignores };
