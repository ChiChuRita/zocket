export default defineAppConfig({
  shadcnDocs: {
    site: {
      name: 'Zocket',
      description: 'Type-safe WebSocket library with end-to-end type safety, similar to tRPC.',
    },
    theme: {
      customizable: true,
      color: 'zinc',
      radius: 0.5,
    },
    header: {
      title: 'Zocket',
      showTitle: true,
      darkModeToggle: true,
      languageSwitcher: {
        enable: false,
        triggerType: 'icon',
        dropdownType: 'select',
      },
      logo: {
        light: '/logo.svg',
        dark: '/logo-dark.svg',
      },
      nav: [{
        title: 'Docs',
        to: '/introduction',
        target: '_self',
        links: []
      }],
      links: [{
        icon: 'lucide:github',
        to: 'https://github.com/ChiChuRita/zocket',
        target: '_blank',
      }],
    },
    aside: {
      useLevel: false,
      collapse: false,
    },
    main: {
      breadCrumb: true,
      showTitle: true,
    },
    footer: {
      credits: 'Copyright © 2024',
      links: [{
        icon: 'lucide:github',
        to: 'https://github.com/ChiChuRita/zocket',
        target: '_blank',
      }],
    },
    toc: {
      enable: true,
      links: [{
        title: 'Star on GitHub',
        icon: 'lucide:star',
        to: 'https://github.com/ChiChuRita/zocket',
        target: '_blank',
      }, {
        title: 'Create Issues',
        icon: 'lucide:circle-dot',
        to: 'https://github.com/ChiChuRita/zocket/issues',
        target: '_blank',
      }],
    },
    search: {
      enable: true,
      inAside: false,
    }
  }
});