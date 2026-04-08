# Platform

This note defines the MVP Zocket platform product: the authenticated app, account flow, dashboard, and CLI deploy path.

The platform should feel closer to TanStack or WorkOS than to a heavy enterprise control plane:

- technical and clean
- productized but not bloated
- one obvious path from sign-up to first deploy

This should stay very MVP-ish.

## Stack

The v1 platform stack should be:

- TanStack Start for the dashboard app shell, routing, and frontend
- `shadcn/ui` for the dashboard component layer
- Cloudflare hosting for the dashboard, same as the docs site
- WorkOS AuthKit for authentication
- Convex for backend logic and database

This is the right MVP tradeoff:

- fast to build
- one clear frontend stack
- same hosting posture for docs and dashboard
- good auth out of the box
- no custom control-plane backend to maintain yet
- one simple place for platform data and mutations

## UI Preset

Use the `shadcn` preset with:

- `--preset b7ClRnk2C`

This should be the default visual and component starting point for the MVP platform.

The goal is to avoid spending time inventing a design system too early while still getting a clean, technical interface.

The rule is:

- strictly use `shadcn` components
- do not try to design too much from scratch
- do not introduce a custom design system in v1

## Product Goal

The platform only needs to do a few things well:

- let a developer create an account
- let them create a project
- let them get a deploy token
- let them deploy with the CLI
- let them see whether the project is live

That is enough for v1.

## Surface Area

The platform should have two surfaces:

1. authenticated dashboard
2. CLI

If those two surfaces feel coherent, the platform already feels real.

## Account Model

Keep the account model minimal.

Recommended v1 shape:

- user account
- one default workspace created automatically on sign-up
- projects live inside that workspace

This gives a path to team support later without forcing full organization management now.

The model can be:

- `user`
- `workspace`
- `project`
- `deployment`
- `api_token`

Those records should live in Convex for v1.

You can call the container `workspace` or `team`. `workspace` is probably the better MVP word.

## Authentication

Use a boring hosted auth system.

The simplest good choice is:

- WorkOS AuthKit
- GitHub login first
- email login or magic link as a fallback

Why:

- fast to ship
- looks polished
- less custom auth work
- easy path to teams and enterprise features later if needed

Do not build custom auth for the MVP platform.

Convex should hold the platform-side user, workspace, project, deployment, and token records.

## Dashboard

The dashboard should be extremely small.

V1 pages:

- sign in / sign up
- dashboard home
- create project
- project detail
- deployments list
- token creation

That is enough.

The dashboard backend should stay thin:

- Cloudflare hosts the frontend
- Convex queries for reads
- Convex mutations for actions
- TanStack UI on top

### Dashboard home

Show:

- list of projects
- latest deployment status
- project domain like `acme.zocket.io`
- button to create a new project

### Project detail

Show:

- project name
- default domain
- current active deployment
- recent deployments
- CLI install and deploy command
- API token section

### Token page or section

Allow:

- create deploy token
- copy once
- revoke token later

That is the minimum required for CLI-based deploys.

## CLI Flow

The CLI should be the main deployment interface.

The ideal MVP flow is:

1. `zocket auth`
2. the CLI starts a WorkOS CLI Auth flow
3. the CLI opens the verification URL or prints it
4. the user signs in on the platform
5. the CLI polls until WorkOS returns tokens
6. the CLI stores the resulting user token locally
7. `zocket init` or `zocket link`
8. `zocket deploy`

The important product behavior is:

- auth happens on the platform, not inside the terminal
- the CLI should just launch the login flow and receive the result

The clean MVP implementation is to use WorkOS CLI Auth directly:

- CLI requests a device authorization from WorkOS
- WorkOS returns a device code, user code, verification URL, and polling interval
- CLI opens the verification URL automatically when possible
- user logs in with WorkOS AuthKit
- CLI polls WorkOS until the device flow completes
- CLI stores the resulting token set in a local config file

If opening the browser fails, the fallback can be:

- print the verification URL and user code
- ask the user to open it manually

That deploy command should:

- package the bundle
- upload it through the platform API
- store the bundle in Convex file storage
- create a deployment record in Convex
- trigger a runtime update
- print the project domain

If possible, `zocket deploy` should also print the live WebSocket URL immediately.

## First-Run Experience

The first-run experience matters more than control-plane breadth.

A new user should be able to:

1. sign up
2. create a project
3. install the CLI
4. log in from the CLI
5. deploy once
6. connect to `wss://project-or-tenant.zocket.io`

If that loop feels clean, the platform is good enough for v1.

## Deployment Model

For the dashboard and CLI, the platform only needs to support one deployment concept:

- upload a versioned bundle
- store deployment metadata in Convex
- mark one version active
- restart or refresh the dedicated runtime for that project or tenant

Do not add complicated rollout controls yet.

No need for:

- canaries
- staged rollouts
- environment matrices
- branch previews

Not in v1.

## MVP Visual Direction

The platform should feel technical and calm.

UI rules:

- use the selected `shadcn` preset
- keep layouts plain and functional
- prefer standard `shadcn` tables, forms, dialogs, cards, and tabs
- avoid custom visual experiments
- avoid building bespoke components unless the flow truly needs one

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

Those can come after the first deploy flow works well.

## Short Version

The MVP platform should be:

- a very small dashboard
- TanStack Start frontend
- `shadcn/ui` components
- Cloudflare-hosted web app
- WorkOS AuthKit
- Convex backend and database
- one default workspace per user
- project creation
- deploy tokens
- `zocket auth` and `zocket deploy`

If that loop feels polished, the platform is good enough.
