import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * One flat config for the whole workspace. Run from the repo root: `pnpm lint`.
 *
 * The no-restricted-syntax rule enforces docs/04-DESIGN-SYSTEM.md: colour
 * values may only exist in @recallify/tokens, so web and React Native can never
 * drift apart. Everywhere else a raw hex literal fails the build.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.config.*',
      'apps/api/prisma/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message:
            'Raw hex colour. Import it from @recallify/tokens instead (docs/04-DESIGN-SYSTEM.md).',
        },
      ],
    },
  },
  {
    // The one place colour is allowed to exist.
    files: ['packages/tokens/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
