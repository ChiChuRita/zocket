import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightThemeNext from "starlight-theme-next";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  integrations: [
    starlight({
      plugins: [starlightThemeNext()],
      expressiveCode: {
        themes: ["github-dark"],
      },
      title: "Zocket",
      description:
        "Typed actor runtime for realtime applications. Define actors, call methods, subscribe to state — all end-to-end type-safe.",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/ChiChuRita/zocket" },
      ],
      favicon: "/favicon.svg",
      components: {
        ThemeSelect: "./src/components/Empty.astro",
        Head: "./src/components/Head.astro",
      },
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "Getting Started",
          slug: "getting-started",
        },
        {
          label: "Motivation",
          slug: "motivation",
        },
        {
          label: "Comparison",
          slug: "comparison",
        },
        {
          label: "Core Concepts",
          items: [
            { label: "Actors", slug: "core/actors" },
            { label: "Apps", slug: "core/apps" },
            { label: "Middleware", slug: "core/middleware" },
            { label: "Protocol", slug: "core/protocol" },
            { label: "Types", slug: "core/types" },
          ],
        },
        {
          label: "Server",
          items: [
            { label: "Bun Adapter", slug: "server/bun-adapter" },
            { label: "Node Adapter", slug: "server/node-adapter" },
            { label: "Deno Adapter", slug: "server/deno-adapter" },
            { label: "Custom Handlers", slug: "server/custom-handlers" },
          ],
        },
        {
          label: "Client",
          items: [
            { label: "Creating a Client", slug: "client/creating-a-client" },
            { label: "Actor Handles", slug: "client/actor-handles" },
            { label: "State Store", slug: "client/state-store" },
          ],
        },
        {
          label: "React",
          items: [
            { label: "Setup", slug: "react/setup" },
            { label: "Hooks", slug: "react/hooks" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Authentication", slug: "guides/authentication" },
            { label: "State Management", slug: "guides/state-management" },
            { label: "Multiplayer Draw", slug: "guides/multiplayer-draw" },
          ],
        },
        {
          label: "Legacy (v1)",
          collapsed: true,
          badge: { text: "Old", variant: "caution" },
          autogenerate: { directory: "legacy" },
        },
      ],
    }),
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
});
