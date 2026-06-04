export default defineNuxtConfig({
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  experimental: {
    appManifest: false
  },
  app: {
    head: {
      title: 'Makings',
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/favicon.svg'
        }
      ],
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1'
        },
        {
          name: 'description',
          content: 'a free freefrom social network'
        }
      ]
    }
  },
  compatibilityDate: '2025-12-01'
})
