import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import pluginN from 'eslint-plugin-n'
import pluginImport from 'eslint-plugin-import-x'

export default [
  { ignores: ['dashboard/'] },
  js.configs.recommended,
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: false,
    commaDangle: 'never',
    braceStyle: '1tbs',
    arrowParens: false
  }),
  pluginN.configs['flat/recommended'],
  pluginImport.flatConfigs.recommended,
  {
    rules: {
      '@stylistic/space-before-function-paren': ['error', 'always'],
      '@stylistic/arrow-parens': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'n/no-process-exit': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
      'n/no-unsupported-features/es-builtins': 'off',
      'n/no-unsupported-features/es-syntax': 'off',
      'n/no-unpublished-import': 'off',
      'n/hashbang': 'off',
      'import-x/no-unresolved': 'off',
      'import-x/no-named-as-default-member': 'off'
    }
  }
]
