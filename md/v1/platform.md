# Platform

This note defines the current MVP Zocket platform product: the authenticated
dashboard, control-plane API, account flow, and CLI deploy path.

The platform should feel closer to TanStack or WorkOS than to a heavy enterprise
control plane:

- technical and clean
- productized but not bloated
- one obvious path from sign-up to first deploy

This should stay MVP-ish, but it must match the implementation.

## Stack

The current v1 platform stack is:

- TanStack Start for the dashboard app shell, routing, and frontend
- Cloudflare Workers for the platform app
- Elysia mounted under `/api` for the control-plane API
- WorkOS AuthKit for browser authentication
- Neon Postgres for platform data
- Drizzle for schema and migrations
- S3-compatible object storage for deployment bundles
- Pulumi ESC for shared local/deploy configuration

The older Convex plan is no longer current. Platform records now live in Neon,
and deployment bundles live in S3-compatible storage.

## UI Preset

The dashboard should continue using the existing component direction:

- `shadcn/ui`-style components
- restrained technical UI
- standard tables, forms, cards, tabs, alerts, and buttons
- no custom design system until the first deploy loop works end to end

## Product Goal

The platform only needs to do a few things well:

- let a developer create an account
- create a default workspace
- let them create a project
- let them get a deploy token
- let them deploy with the CLI
- let them see whether the project is live

That is enough for v1.

## Surface Area

The platform has two product surfaces:

1. authenticated dashboard
2. CLI

The dashboard and CLI talk to the same Elysia control-plane API.

## Account Model

Keep the account model minimal.

Current v1 shape:

- `user`
- `workspace`
- `workspace_membership`
- `project`
- `project_auth_config`
- `runtime_config`
- `deployment`
- `deploy_token`
- `cli_token`
- `device_flow`

Those records live in Neon through Drizzle. A default workspace is created when a
browser-authenticated WorkOS user first touches the platform API.

## Authentication

There are two auth paths.

Browser auth:

- WorkOS AuthKit handles sign-in.
- TanStack Start obtains the WorkOS session.
- The `/api/$` route forwards verified WorkOS identity to the mounted Elysia app.
- The Elysia API upserts the platform user and workspace in Neon.

CLI auth:

- `zocket auth` starts a platform device flow.
- The CLI prints and opens the `/verify` URL.
- The user approves the device flow in the browser after WorkOS sign-in.
- The platform mints a `cli_token` stored in `~/.zocket/config.json`.

Deploy auth:

- `zocket init` and `zocket link` create deploy tokens.
- `zocket deploy` uploads bundles using a project deploy token.
- Deploy tokens are hashed in Neon and can be revoked.

## Dashboard

The dashboard should remain small.

Current v1 pages:

- sign in / sign up
- dashboard home
- create project
- project detail
- CLI verification page

Dashboard home shows:

- workspace name
- list of projects
- deployment status
- project WebSocket endpoint
- create project button

Project detail shows:

- project name
- default domain
- deployment status
- deploy token creation
- CLI connection values

## CLI Flow

The CLI is the main deployment interface.

Current MVP flow:

1. `zocket auth`
2. platform creates a device flow
3. CLI opens `/verify?deviceCode=...`
4. user signs in with WorkOS and approves the session
5. CLI polls until the platform returns a CLI token
6. `zocket init --name <name> --entry <file>` creates a project and default deploy token
7. `zocket link --project <slug>` links an existing project and creates a deploy token
8. `zocket deploy` bundles the entry with Bun and uploads it to `/api/deployments`

The deploy command currently:

- bundles the entry with `Bun.build({ target: "bun", format: "esm" })`
- stores the bundle in S3-compatible object storage
- creates a deployment row in Neon
- marks the project active deployment
- calls `ensureProjectRuntime(...)`

## Current Runtime Caveat

`ensureProjectRuntime(...)` is still a stub in
`platform/src/server/deploy.ts`.

That means the platform can create projects, issue tokens, store bundles, and
record deployments, but it cannot yet automatically create or update the
per-project AWS runtime service end to end.

Until that is implemented, the hosted deploy story is incomplete.

## Deployment Model

The platform only needs one deployment concept in v1:

- upload a versioned bundle
- store deployment metadata in Neon
- store bundle code in S3-compatible storage
- mark one deployment active for the project
- start or update the dedicated project runtime
- runtime fetches the active bundle from the platform API
- runtime reports ready or failed status back to the platform

Do not add complicated rollout controls yet.

No need for:

- canaries
- staged rollouts
- environment matrices
- branch previews

Rollback is important, but it should be a focused deploy reliability feature, not
a full release-management system.

## Environment

The canonical dev configuration lives in:

- `infra/esc/platform-dev.yaml`

Expected platform values include:

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

## Out Of Scope

Do not add these yet:

- team invites
- billing
- usage analytics
- custom domains
- environment promotion
- secrets UI beyond a basic key-value form
- advanced audit logs
- RBAC complexity

Those can come after the first deploy flow works end to end.

## Short Version

The MVP platform is:

- a small TanStack Start dashboard
- Cloudflare Workers hosting
- WorkOS AuthKit
- Elysia control-plane API
- Neon + Drizzle platform database
- S3-compatible deployment bundle storage
- one default workspace per user
- project creation
- deploy tokens
- `zocket auth`, `zocket init`, `zocket link`, and `zocket deploy`

The major missing piece is automatic project runtime orchestration.
