import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  {
    ignores: ['dist', 'pnpm-lock.yaml', 'tsdown.config.ts', 'vitest.config.ts'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended-type-checked'].rules,
      ...eslintConfigPrettier.rules,
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
]
