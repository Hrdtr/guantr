import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Guantr",
  description: "Flexible, type-safe JavaScript library for efficient authorization and permission checking",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quick Start', link: '/quick-start' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Guantr?', link: '/introduction' },
          { text: 'Quick Start', link: '/quick-start' },
        ]
      },
      {
        text: 'Guides',
        items: [
          {
            text: 'Defining Rules',
            link: '/guides/defining-rules',
            items: [
              { text: 'Condition Operators', link: '/guides/defining-rules/condition-operators' },
            ]
          },
          { text: 'Context Usage', link: '/guides/context-usage' },
          { text: 'Typescript', link: '/guides/typescript-integration' },
          { text: 'Example: Basic RBAC', link: '/guides/example-basic-rbac' },
          { text: 'Example: ABAC', link: '/guides/example-abac' },
        ]
      },
      {
        text: 'Advanced Usage',
        items: [
          { text: 'Custom Storage Adapter', link: '/advanced-usage/custom-storage-adapter' },
          { text: 'Caching', link: '/advanced-usage/caching' },
          {
            text: 'Rules as Query Filters',
            items: [
              { text: 'Prisma', link: '/advanced-usage/rules-as-query-filters/prisma' },
            ]
          },
        ]
      },
      {
        text: 'API',
        items: [
          {
            text: 'createGuantr',
            link: '/api/createGuantr',
          },
          {
            text: 'Guantr',
            items: [
              {
                text: '.setRules',
                link: '/api/Guantr/setRules'
              },
              {
                text: '.getRules',
                link: '/api/Guantr/getRules'
              },
              {
                text: '.relatedRulesFor',
                link: '/api/Guantr/relatedRulesFor'
              },
              {
                text: '.can',
                link: '/api/Guantr/can'
              },
              {
                text: '.cannot',
                link: '/api/Guantr/cannot'
              }
            ]
          },
        ]
      }
    ],

    footer: {
      message: 'Released under the <a href="https://github.com/Hrdtr/guantr/blob/main/LICENSE">MIT License</a>.',
      copyright: 'Copyright © 2024 <a href="https://github.com/Hrdtr">Herdi Tr.</a>'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Hrdtr/guantr' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/guantr' },
    ]
  }
})
