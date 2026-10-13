// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default defineConfig([
  {
    // Generated (types:gen, routes.mjs) or build output — never hand-edited, never linted.
    ignores: ['src/app/core/api/store-api.types.ts', 'src/app/prerender-manifest.ts', 'dist/**', 'docs/**', '.angular/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', '.lighthouseci/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic, angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'core', pattern: 'src/app/core/**' },
        { type: 'shared', pattern: 'src/app/shared/**' },
        { type: 'layout', pattern: 'src/app/layout/**' },
        { type: 'store', pattern: 'src/app/features/store/**' },
        { type: 'account', pattern: 'src/app/features/account/**' },
        { type: 'admin', pattern: 'src/app/features/admin/**' },
      ],
      'import/resolver': { node: { extensions: ['.js', '.ts'] } },
    },
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'ta', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'ta', style: 'kebab-case' }],
      '@typescript-eslint/no-explicit-any': 'error',
      // Plan §2.3: features → shared → core; layout → core (+ shared UI); nothing imports from features;
      // features/admin never imports from features/store.
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            { from: { element: { type: 'core' } }, disallow: { to: { element: { types: { anyOf: ['shared', 'layout', 'store', 'account', 'admin'] } } } }, message: 'core/ is the bottom layer — it imports nothing from shared/, layout/ or features/.' },
            { from: { element: { type: 'shared' } }, disallow: { to: { element: { types: { anyOf: ['layout', 'store', 'account', 'admin'] } } } }, message: 'shared/ may only depend on core/.' },
            { from: { element: { type: 'layout' } }, disallow: { to: { element: { types: { anyOf: ['store', 'account', 'admin'] } } } }, message: 'layout/ may not import from features/.' },
            { from: { element: { type: 'admin' } }, disallow: { to: { element: { types: { anyOf: ['store', 'account'] } } } }, message: 'features/admin never imports from features/store or features/account (plan §2.3).' },
            { from: { element: { type: 'store' } }, disallow: { to: { element: { types: { anyOf: ['admin', 'account'] } } } }, message: 'features never import from other feature areas — move shared pieces to shared/ or core/.' },
            { from: { element: { type: 'account' } }, disallow: { to: { element: { types: { anyOf: ['admin', 'store'] } } } }, message: 'features never import from other feature areas — move shared pieces to shared/ or core/.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'MemberExpression[property.name=/^bypassSecurityTrust/]', message: 'Never bypass the sanitiser (CLAUDE.md non-negotiable #11).' },
        { selector: "CallExpression[callee.name='parseFloat']", message: 'Money is a decimal string — use core/money (halalas), never parseFloat (plan §6).' },
        { selector: "CallExpression[callee.object.name='Number'][callee.property.name='parseFloat']", message: 'Money is a decimal string — use core/money (halalas), never parseFloat.' },
        { selector: "CallExpression[callee.object.name=/^(localStorage|sessionStorage)$/] Literal[value=/token|auth|jwt|session/i]", message: 'Tokens live in signals, never in web storage (CLAUDE.md non-negotiable #9).' },
      ],
      'no-restricted-imports': [
        'error',
        { paths: [{ name: '@angular/common/http', importNames: ['HttpClient'], message: 'Components read through *.data.ts (httpResource) — inject HttpClient only in core/ or a *.data.ts service.' }] },
      ],
    },
  },
  {
    // HttpClient is allowed where plan §2.3 puts API access: core services and feature data services.
    files: ['src/app/core/**/*.ts', 'src/**/*.data.ts', 'src/**/*.spec.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
  {
    files: ['scripts/**/*.mjs', 'e2e/**/*.ts', '*.config.ts', '*.js'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', fetch: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', FormData: 'readonly', Blob: 'readonly', localStorage: 'readonly' } },
  },
]);
