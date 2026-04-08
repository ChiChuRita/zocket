# Zocket Platform

TanStack Start dashboard and mounted Elysia control plane for hosted Zocket.

## Stack

- WorkOS AuthKit for browser auth
- Elysia mounted at `/api`
- Neon + Drizzle for platform data
- S3-compatible object storage for deployment bundles

## Environment

The canonical dev environment lives in:

- `../infra/esc/platform-dev.yaml`

Load it into Pulumi ESC:

```sh
pulumi env init <org>/zocket/platform-dev
pulumi env edit --file ../infra/esc/platform-dev.yaml <org>/zocket/platform-dev
```

That one ESC environment is the source of truth for local platform development and Pulumi stacks.

Expected values in that environment:

- `DATABASE_URL`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_REDIRECT_URI`
- `WORKOS_COOKIE_PASSWORD`
- `AWS_REGION`
- `S3_BUCKET`
- `S3_ENDPOINT`
- `S3_FORCE_PATH_STYLE`
- `PLATFORM_PUBLIC_URL`
- `CONTROL_PLANE_URL`
- `CONTROL_PLANE_INTERNAL_TOKEN`

## WorkOS Setup

In the WorkOS dashboard:

1. Add `http://localhost:3000/api/auth/callback` as a redirect URI.
2. Set a local app homepage or sign-out redirect URL.
3. Use the same environment's `WORKOS_CLIENT_ID` and `WORKOS_API_KEY` in `infra/esc/platform-dev.yaml`.

## Database

Generate or apply migrations from the `platform` directory:

```sh
pulumi env run <org>/zocket/platform-dev -- bun run db:generate
pulumi env run <org>/zocket/platform-dev -- bun run db:migrate
```

The repo already includes an initial SQL migration in `drizzle/0000_initial.sql`.

## Development

```sh
bun install
bun run platform:dev
```

The dashboard, Elysia API, and WorkOS callback routes all run through the TanStack Start app on `http://localhost:3000`.

To use a different ESC environment:

```sh
bun run platform:dev -- <org>/zocket/platform-dev
```

## Build

```sh
bun run build
```

## Deploy

From the repo root:

```sh
bun run platform:push
```

`platform:push` builds the app and deploys it with the `platform-prod` ESC environment when it exists, otherwise it falls back to `platform-dev`.

To deploy with a specific ESC environment:

```sh
bun run platform:push -- <org>/zocket/platform-prod
```
