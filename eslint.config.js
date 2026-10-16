import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'dist/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  { files: ['js/**/*.js'], languageOptions: { globals: globals.browser } },
  { files: ['sw.js'], languageOptions: { globals: globals.serviceworker } },
  {
    files: ['test/**/*.js', 'scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
