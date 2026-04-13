// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const globals = require('globals');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    '**/.expo/**',
    '**/supabase/**',
    '**/coverage/**',
  ]),
  ...expoConfig,
  {
    files: ['babel.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    rules: {
      // User-facing copy uses normal apostrophes; HTML escapes are undesirable in RN UI.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
