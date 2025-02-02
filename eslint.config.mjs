import eslint from '@eslint/js'
import tseslint, { configs as tseslintConfigs } from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

/** @type {import('eslint').Linter.Config} */
export default tseslint.config(
  eslint.configs.recommended,
  tseslintConfigs.recommended,
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
)
