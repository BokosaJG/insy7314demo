// ESLint (flat config) - static code analysis for the API.
// eslint-plugin-security flags risky patterns: eval, child_process, unsafe
// regular expressions (ReDoS), object-injection sinks, timing-unsafe compares,
// non-literal fs/require paths, etc. Run by `npm run lint` and in CI.
const js = require('@eslint/js');
const globals = require('globals');
const security = require('eslint-plugin-security');
const jest = require('eslint-plugin-jest');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'reports/**', 'certs/**', 'logs/**'] },
  js.configs.recommended,
  security.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$' }],
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': 'error', // all output goes through the structured logger
      'prefer-const': 'error',
    },
  },
  {
    files: ['scripts/**/*.js'],
    rules: { 'no-console': 'off' }, // CLI helper scripts print to the terminal on purpose
  },
  {
    files: ['tests/**/*.js', 'jest.config.js'],
    ...jest.configs['flat/recommended'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...globals.jest } },
    rules: {
      ...jest.configs['flat/recommended'].rules,
      'no-console': 'off',
      'security/detect-object-injection': 'off', // test data indexing only
      'jest/no-conditional-expect': 'off',
    },
  },
];
