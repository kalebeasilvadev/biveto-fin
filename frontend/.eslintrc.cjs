module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    'playwright-report',
    'test-results',
    'public',
    '.eslintrc.cjs',
    'scripts',
    // TODO(backlog #9): incluir e2e/ no lint quando as suítes duplicadas forem consolidadas
    'e2e',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // Aspiracional por ora: aparece como warning, não bloqueia o CI (backlog #8: tipar a camada de services)
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
}
