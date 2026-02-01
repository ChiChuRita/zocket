# Zocket Docs

This folder contains the documentation site for Zocket, built with Nuxt 3 and `shadcn-docs-nuxt`.

## Development

From the repo root:

```bash
bun install
cd docs
bun run dev
```

## Build / Preview

```bash
cd docs
bun run build
bun run preview
```

## Editing content

Docs pages live in `docs/content/` and are written in Markdown (Nuxt Content). Files are prefixed with numbers to control ordering in the sidebar (e.g. `1.introduction.md`, `4.server/index.md`).

Static assets live in `docs/public/`.
