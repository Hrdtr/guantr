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
                text: '.withContext',
                link: '/api/Guantr/withContext'
              },
              {
                text: '.context',
                link: '/api/Guantr/context'
              },
              {
                text: '.permissions',
                link: '/api/Guantr/permissions'
              },
              {
                text: '.setPermission',
                link: '/api/Guantr/setPermission'
              },
              {
                text: '.setPermissions',
                link: '/api/Guantr/setPermissions'
              },
              {
                text: '.relatedPermissionsFor',
                link: '/api/Guantr/relatedPermissionsFor'
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
