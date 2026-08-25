import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Shared flat config. Each package re-exports this and appends its own layer.
 *
 * The no-raw-hex rule enforces docs/04-DESIGN-SYSTEM.md: every colour value must
 * come from @recallify/tokens, so web and native can never drift apart.
 */
export const noRawHex = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
        message:
          'Raw hex colour. Import it from @recallify/tokens instead (docs/04-DESIGN-SYSTEM.md).',
      },
    ],
  },
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  { ignores: ['dist/**', '.next/**', 'coverage/**', 'node_modules/**'] },
);
