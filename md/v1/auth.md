# Authentication

This note defines the current v1 model for platform identity, application auth,
request routing, and tenant separation.

The main constraint is deliberate:

- shared Bun gateways
- shared NATS / JetStream
- dedicated actor runtimes per project
- no Firecracker or microVM isolation yet

That is enough for an MVP only if every internal route is scoped by workspace
and project.

## V1 Shape

The current v1 shape is:

- each user signs in through WorkOS AuthKit
- the platform creates or loads a default workspace
- projects live inside a workspace
- each project gets a default domain like `project-slug.zocket.io`
- the gateway resolves the project from the request hostname
- the gateway asks the control plane to authorize the connection
- all NATS subjects include `workspaceId` and `projectId`
- each project runtime loads only that project's active bundle

This gives a clean split:

- Cloudflare is public DNS and platform hosting
- gateways are shared ingress
- NATS is the shared bus
- runtimes are the project execution boundary
- Neon is the platform system of record

## Identity Model

The useful internal identity shape is:

- `userId` for the platform user
- `workspaceId` for tenancy and ownership
- `projectId` for deployed app/runtime scope
- `project.slug` for dashboard and CLI lookup
- `project.domain` for gateway routing

Internal routing should use `workspaceId` and `projectId`, not hostnames or slugs
alone.

## Domain Model

Every project gets a default subdomain under `zocket.io`.

The v1 rule is simple:

- the hostname identifies the project at ingress

That means:

- `wss://my-project.zocket.io` routes to the `my-project` platform project
- the gateway derives project identity from the `Host` header
- clients do not get to choose workspace or project identity in the payload

Custom domains can come later. The default subdomain is enough for the MVP.

## Two Auth Problems

There are two different auth layers and they should stay separate.

### Control-plane auth

This is for:

- dashboard sign-in
- project creation
- deploy access
- token management
- runtime reports
- internal gateway authorization

Current implementation:

- WorkOS AuthKit for browser sign-in
- platform-created device flow for CLI auth
- hashed `cli_tokens` and `deploy_tokens` in Neon
- `CONTROL_PLANE_INTERNAL_TOKEN` for gateway and runtime internal API calls

### Application auth

This is for the tenant project's own end users connecting to the deployed app.

The current model supports project auth configs:

- `none`
- `jwt-secret`
- `jwt-jwks`

At WebSocket upgrade time:

1. the gateway reads `token` from the URL query string
2. the gateway sends `{ host, token }` to `/api/registry/authorize`
3. the control plane resolves the project by host
4. if configured, the control plane verifies the JWT in that project's context
5. verified `userId` and claims are returned to the gateway
6. gateway stores them on the session
7. runtime forwards them into actor method middleware and lifecycle metadata

The key rule is:

- auth verification is project-aware

A token that is valid for one project should not be accepted under another
project's domain.

## Request Flow

At connection time the gateway should:

1. read the hostname
2. resolve the project through the control plane
3. load the project's auth configuration
4. verify the user token in that project context
5. create a session tagged with `workspaceId`, `projectId`, `sessionId`, `userId`, and claims
6. publish actor messages only to scoped NATS subjects

Every session should carry:

- `workspaceId`
- `projectId`
- `sessionId`
- authenticated app user identity if present
- verified auth claims

That context should flow through every actor call.

## Scoped Addressing

Actor identity must always include project context.

The real address shape is:

- `(workspaceId, projectId, actorType, actorId)`

That means:

- method calls are project-scoped
- subscriptions are project-scoped
- snapshots are project-scoped
- outbound events are project-scoped

Shared infrastructure is only safe if project scope is built into every internal
key.

## Shared NATS Model

A shared NATS / JetStream cluster is acceptable in v1 if subjects and
permissions are scoped.

The current subject shape is:

- `inbound.{workspaceId}.{projectId}.{actorType}.{actorId}`
- `outbound.{workspaceId}.{projectId}.{sessionId}`
- `session.connected.{workspaceId}.{projectId}`
- `session.disconnected.{workspaceId}.{projectId}`

The most important rule is:

- project runtimes should consume only their own project subjects

NATS is shared transport, not shared execution.

## Dedicated Runtime Layer

Each project should get a dedicated actor runtime service.

Those runtimes should:

- load only that project's active bundle
- consume only that project's inbound subjects
- emit only that project's outbound subjects
- hold only that project's hot actor state
- report deployment status for that project

This is the core v1 isolation boundary and the reason Firecracker is not
required yet.

## Security Rules

This setup only works if a few rules are enforced everywhere:

- every routing key includes `workspaceId` and `projectId`
- the gateway derives project identity from hostname, not client payload
- auth config is loaded per project
- runtime credentials and consumers are scoped per project
- bundle references and stored file keys are project-scoped
- logs and admin APIs always carry workspace and project context
- actor manager keys should include project scope, not just actor name and actor ID
- state and event subscriptions need per-client authorization before external launch

Without these rules, shared infrastructure becomes dangerous quickly.

## What This Defers

V1 intentionally defers:

- per-project gateway fleets
- per-project NATS clusters
- custom domain automation
- advanced multi-environment routing
- built-in auth-provider features beyond token verification
- stronger code sandboxing
- microVM tenant isolation

That is a good tradeoff for the MVP.

## Short Version

If someone asks how v1 auth and tenancy work, the answer is:

- platform users sign in with WorkOS
- projects live in workspaces stored in Neon
- every project gets `project.zocket.io`
- the gateway resolves the project from the hostname
- app auth is verified in that project's context
- NATS is shared but subjects are scoped by workspace and project
- each project gets a dedicated actor runtime
- this gives useful separation without Firecracker yet
