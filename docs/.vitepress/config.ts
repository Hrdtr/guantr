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
        text: 'References',
        items: [
          {
            text: 'createGuantr',
          },
          {
            text: 'Guantr',
            items: [
              {
                text: '.withContext'
              },
              {
                text: '.context'
              },
              {
                text: '.permissions'
              },
              {
                text: '.setPermission'
              },
              {
                text: '.setPermissions'
              },
              {
                text: '.relatedPermissionsFor'
              },
              {
                text: '.can'
              },
              {
                text: '.cannot'
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
