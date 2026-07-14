import { defineConfig } from 'vitepress';
import llmstxt, { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Guantr',
  description: 'Flexible, type-safe JavaScript library for authorization and permission checking',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quick Start', link: '/quick-start' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Guantr?', link: '/introduction' },
          { text: 'Quick Start', link: '/quick-start' },
        ],
      },
      {
        text: 'Guides',
        items: [
          {
            text: 'Defining Rules',
            link: '/guides/defining-rules',
            items: [
              { text: 'Condition Operators', link: '/guides/defining-rules/condition-operators' },
              { text: 'Rule Validation', link: '/guides/defining-rules/rule-validation' },
            ],
          },
          { text: 'Context Usage', link: '/guides/context-usage' },
          { text: 'Abstract vs Resource-Aware', link: '/guides/abstract-vs-resource-aware' },
          { text: 'TypeScript Integration', link: '/guides/typescript-integration' },
        ],
      },
      {
        text: 'Patterns & Examples',
        items: [
          { text: 'Common Patterns', link: '/guides/common-patterns' },
          { text: 'Database-Backed Rules', link: '/guides/database-backed-rules' },
        ],
      },
      {
        text: 'Advanced Usage',
        items: [
          { text: 'Custom Storage Adapter', link: '/advanced-usage/custom-storage-adapter' },
          { text: 'Caching', link: '/advanced-usage/caching' },
          {
            text: 'Rules as Query Filters',
            items: [{ text: 'Prisma', link: '/advanced-usage/rules-as-query-filters/prisma' }],
          },
        ],
      },
      {
        text: 'References',
        items: [
          { text: 'Performance Considerations', link: '/references/performance-considerations' },
          {
            text: 'Comparison with Alternatives',
            link: '/references/comparison-with-alternatives',
          },
          { text: 'Migration: v1 to v2', link: '/guides/migration-v1-to-v2' },
          { text: 'Glossary', link: '/references/glossary' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'createGuantr', link: '/api/createGuantr' },
          {
            text: 'Guantr',
            items: [
              { text: 'constructor', link: '/api/Guantr/constructor' },
              { text: 'setRules', link: '/api/Guantr/setRules' },
              { text: 'getRules', link: '/api/Guantr/getRules' },
              { text: 'relatedRulesFor', link: '/api/Guantr/relatedRulesFor' },
              { text: 'can', link: '/api/Guantr/can' },
              { text: 'cannot', link: '/api/Guantr/cannot' },
              { text: 'can.abstract', link: '/api/Guantr/can.abstract' },
              { text: 'cannot.abstract', link: '/api/Guantr/cannot.abstract' },
              { text: 'can.all', link: '/api/Guantr/can.all' },
              { text: 'can.any', link: '/api/Guantr/can.any' },
              { text: 'cannot.all', link: '/api/Guantr/cannot.all' },
              { text: 'cannot.any', link: '/api/Guantr/cannot.any' },
            ],
          },
          { text: 'Error Classes', link: '/api/error-classes' },
          { text: 'Utilities', link: '/api/utilities' },
        ],
      },
    ],

    outline: {
      level: [2, 3],
    },

    search: {
      provider: 'local',
      options: {
        miniSearch: {
          /**
           * @type {Pick<import('minisearch').Options, 'extractField' | 'tokenize' | 'processTerm'>}
           */
          options: {/* ... */},
          /**
           * @type {import('minisearch').SearchOptions}
           * @default
           * { fuzzy: 0.2, prefix: true, boost: { title: 4, text: 2, titles: 1 } }
           */
          searchOptions: {/* ... */},
        },
      },
    },

    footer: {
      message:
        'Released under the <a href="https://github.com/Hrdtr/guantr/blob/main/LICENSE">MIT License</a>.',
      copyright: 'Copyright © 2026 <a href="https://github.com/Hrdtr">Herdi Tr.</a>',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Hrdtr/guantr' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/guantr' },
    ],
  },
  vite: {
    plugins: [llmstxt({ domain: 'https://guantr.hrdtr.dev' })],
  },
  markdown: {
    config(md) {
      md.use(copyOrDownloadAsMarkdownButtons);
    },
  },
});
