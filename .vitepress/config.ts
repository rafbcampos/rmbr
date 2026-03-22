import { defineConfig } from 'vitepress';

export default defineConfig({
  srcDir: 'docs',
  base: '/rmbr/',

  title: 'rmbr',
  description: 'CLI Second Brain for Work',

  head: [
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'rmbr' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Modules', link: '/modules/todo' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation & Setup', link: '/guide/getting-started' },
          { text: 'Core Concepts', link: '/guide/core-concepts' },
        ],
      },
      {
        text: 'Using rmbr',
        collapsed: false,
        items: [
          { text: 'CLI Usage', link: '/guide/cli-usage' },
          { text: 'MCP Setup', link: '/guide/mcp-setup' },
        ],
      },
      {
        text: 'Modules',
        collapsed: false,
        items: [
          { text: 'Todos', link: '/modules/todo' },
          { text: 'Goals', link: '/modules/goals' },
          { text: 'Kudos', link: '/modules/kudos' },
          { text: 'TIL', link: '/modules/til' },
          { text: 'Study', link: '/modules/study' },
          { text: 'Slack', link: '/modules/slack' },
          { text: 'Tags', link: '/modules/tags' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Architecture', link: '/guide/architecture' },
          { text: 'Enrichment', link: '/guide/enrichment' },
        ],
      },
      {
        text: 'Help',
        items: [
          { text: 'FAQ', link: '/guide/faq' },
          { text: 'Contributing', link: '/guide/contributing' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/rafbcampos/rmbr' }],

    editLink: {
      pattern: 'https://github.com/rafbcampos/rmbr/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2024-present Rafael Campos',
    },

    search: {
      provider: 'local',
    },
  },
});
