// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const boundaries = require('eslint-plugin-boundaries');

module.exports = defineConfig([
  {
    // GENERATED — see scripts/types-pull.mjs. Never hand-edited, so never linted.
    // dist/ is build output, not source — without this, `**/*.html` below also matches
    // prerendered pages, and a rule like elements-content then fires on a heading that
    // happens to render empty in the build's initial (pre-interaction) state.
    ignores: ['src/app/core/api.types.ts', 'dist/**', 'docs/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'core', pattern: 'src/app/core/**' },
        { type: 'shared', pattern: 'src/app/shared/**' },
        { type: 'layout', pattern: 'src/app/layout/**' },
        { type: 'features', pattern: 'src/app/features/**' },
      ],
      // Without this, the boundaries plugin can't resolve extension-less relative
      // imports (e.g. `../shared/foo` -> `foo.ts`) and silently treats every
      // dependency as "unknown", so the dependency-direction rule never fires.
      'import/resolver': {
        node: { extensions: ['.js', '.ts'] },
      },
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'ta',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'ta',
          style: 'kebab-case',
        },
      ],
      // Dependency direction: features -> shared -> core. Nothing imports from features.
      // See ../../docs/architecture/02-frontend-architecture.md.
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'core' } },
              disallow: { to: { element: { types: { anyOf: ['shared', 'layout', 'features'] } } } },
              message: 'core/ is a singleton layer — it may not import from shared/, layout/ or features/.',
            },
            {
              from: { element: { type: 'shared' } },
              disallow: { to: { element: { types: { anyOf: ['layout', 'features'] } } } },
              message: 'shared/ may only depend on core/ — it may not import layout/ or features/.',
            },
            {
              from: { element: { type: 'layout' } },
              disallow: { to: { element: { type: 'features' } } },
              message: 'layout/ may depend on core/ and shared/ only — nothing imports from features/.',
            },
          ],
        },
      ],
    },
  },
  {
    // CLAUDE.md non-negotiable #11. Every bypassSecurityTrust* call disables Angular's sanitiser
    // for that value, so there is exactly ONE place allowed to make one — core/trusted-frame-url.ts,
    // which only ever trusts an https URL on an allow-listed iframe host (ADR-010). Everything else
    // binds through the sanitiser.
    files: ['src/**/*.ts'],
    ignores: ['src/app/core/trusted-frame-url.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^bypassSecurityTrust/]',
          message: 'Never bypass the sanitiser here. Iframe URLs go through core/trusted-frame-url.ts (host allow-list); HTML binds via [innerHTML] (CLAUDE.md #11).',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
