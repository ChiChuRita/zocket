export default defineAppConfig({
  shadcnDocs: {
    site: {
      name: "Zocket",
      description:
        "End-to-end type-safe WebSocket library for TypeScript. Built for real-time applications with a tRPC-like developer experience.",
    },
    theme: {
      customizable: true,
      color: "blue",
      radius: 0.5,
    },
    header: {
      title: "Zocket",
      showTitle: true,
      darkModeToggle: true,
      languageSwitcher: {
        enable: false,
        triggerType: "icon",
        dropdownType: "select",
      },
      logo: {
        light: "/logo.svg",
        dark: "/logo-dark.svg",
      },
      nav: [],
      links: [
        {
          icon: "lucide:github",
          to: "https://github.com/yourusername/zocket",
          target: "_blank",
        },
      ],
    },
    aside: {
      useLevel: true,
      collapse: false,
    },
    main: {
      breadCrumb: true,
      showTitle: true,
    },
    footer: {
      credits: "Copyright © 2024 Zocket",
      links: [
        {
          icon: "lucide:github",
          to: "https://github.com/yourusername/zocket",
          target: "_blank",
        },
      ],
    },
    toc: {
      enable: true,
      links: [
        {
          title: "Star on GitHub",
          icon: "lucide:star",
          to: "https://github.com/yourusername/zocket",
          target: "_blank",
        },
        {
          title: "Report Issues",
          icon: "lucide:circle-dot",
          to: "https://github.com/yourusername/zocket/issues",
          target: "_blank",
        },
      ],
    },
    search: {
      enable: true,
      inAside: false,
    },
  },
});
