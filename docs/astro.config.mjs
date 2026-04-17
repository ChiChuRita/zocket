import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightThemeNext from "starlight-theme-next";
import starlightLlmsTxt from "starlight-llms-txt";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://zocket.io",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    starlight({
      plugins: [
        starlightThemeNext(),
        starlightLlmsTxt({
          details:
            "Use these docs as the primary source for Zocket's current API and design. Prefer the main docs over the legacy v1 section unless the user explicitly asks about the old API.\n\nRecommended reading order:\n- Start with Motivation and Getting Started for the mental model\n- Use Core, Client, and React docs for API details\n- Use Guides for concrete implementation patterns",
          customSets: [
            {
              label: "Motivation and Overview",
              description: "Conceptual pages explaining the mental model, actor design, and type-safety story.",
              paths: ["getting-started", "motivation/**", "comparison"],
            },
            {
              label: "Core API",
              description: "Actor, app, middleware, protocol, and type system reference pages.",
              paths: ["core/**"],
            },
            {
              label: "Client and React",
              description: "Client handles, connection lifecycle, state subscriptions, and React bindings.",
              paths: ["client/**", "react/**"],
            },
            {
              label: "Guides",
              description: "Worked examples and implementation patterns.",
              paths: ["guides/**"],
            },
          ],
          exclude: ["legacy/**"],
        }),
      ],
      expressiveCode: {
        themes: ["github-dark"],
      },
      title: "Zocket",
      logo: {
        src: "./src/assets/logo.svg",
      },
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
          items: [
            { label: "Overview", slug: "motivation" },
            { label: "Philosophy", slug: "motivation/philosophy" },
            { label: "Why Actors", slug: "motivation/actors" },
            { label: "Why The Type Safety Is Better", slug: "motivation/type-safety" },
          ],
        },
        {
          label: "Comparison",
          slug: "comparison",
        },
        {
          label: "Use Cases",
          slug: "use-cases",
        },
        {
          label: "Roadmap",
          slug: "roadmap",
          badge: { text: "Soon", variant: "note" },
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
          label: "LLM Docs",
          link: "/llms-full.txt",
          attrs: {
            target: "_blank",
            rel: "noopener noreferrer",
          },
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
  ],
});
