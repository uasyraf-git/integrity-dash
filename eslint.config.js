import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // .validate-build is transient, gitignored tsc output (see tsconfig.validate.json /
  // npm run validate) - never source, never worth linting, same treatment as dist/.
  { ignores: ['dist/**', 'node_modules/**', '.validate-build/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // scripts/ runs under plain Node (npm run validate), not the browser - a separate global
    // set and relaxed no-console (it's a CLI report, not application logging) from the rest of
    // the app.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
);
