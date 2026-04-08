# Authentication

This note defines the v1 model for tenant identity, user auth, request routing, and tenant separation.

The main constraint is deliberate:

- shared Bun gateways
- shared NATS / JetStream
- dedicated actor runtimes per tenant
- no Firecracker or microVM isolation yet

That is enough for an MVP because the most important boundary is still protected: tenant code only runs inside that tenant's dedicated runtime layer.

## V1 Shape

The intended v1 shape is:

- each customer has a tenant record in the control plane
- each tenant gets a default domain like `acme.zocket.io`
- the gateway resolves tenant from the hostname
- the gateway authenticates users in that tenant's context
- all messages are tenant-scoped inside shared NATS
- each tenant's code executes only in that tenant's dedicated runtimes

This gives a clean split:

- gateways are shared ingress
- NATS is the shared bus
- runtimes are the isolation boundary

## Tenant Identity

Each tenant needs a stable internal identity.

The useful shape is:

- `tenantId` as the durable system key
- `slug` as the human-facing identifier
- `defaultDomain` like `acme.zocket.io`
- status and metadata in the control plane

Internal routing should always use `tenantId`, not the raw hostname.

## Domain Model

Every tenant should get a default subdomain under `zocket.io`.

The v1 rule is simple:

- the hostname identifies the tenant at ingress

That means:

- `wss://acme.zocket.io` routes to tenant `acme`
- the gateway derives tenant from the `Host` header
- clients do not get to choose tenant identity directly in the payload

Custom domains can come later. The default subdomain is enough for the MVP.

## Two Auth Problems

There are two different auth layers and they should stay separate.

### Control-plane auth

This is for:

- dashboard sign-in
- project creation
- deploy access
- environment variables
- logs and admin actions

This should use WorkOS AuthKit for sign-in, with tenant membership and related platform records stored in Convex.

### Application auth

This is for the tenant's own end users connecting to the deployed app.

The v1 model should stay simple:

- the tenant configures a JWT secret or JWKS
- the gateway verifies tokens for that tenant
- verified claims are attached to the session and actor context

The key rule is:

- auth verification is tenant-aware

A token that is valid under one tenant should not be accepted under another tenant's domain.

## Request Flow

At connection time the gateway should:

1. read the hostname
2. resolve the tenant
3. load the tenant's auth configuration
4. verify the user token in that tenant's context
5. create a session tagged with `tenantId` and `userId`
6. restrict actor access to that tenant namespace

Every session should carry:

- `tenantId`
- `sessionId`
- authenticated user identity if present
- auth claims

That context should flow through every actor call.

## Tenant-Scoped Addressing

Actor identity must always include tenant context.

The real address shape is:

- `(tenantId, appId, actorType, actorId)`

That means:

- method calls are tenant-scoped
- subscriptions are tenant-scoped
- snapshots are tenant-scoped
- outbound events are tenant-scoped

Shared infrastructure is only safe if tenant scope is built into every internal key.

## Shared NATS Model

A shared NATS / JetStream cluster is acceptable in v1 if subjects and permissions are tenant-scoped.

A good subject shape is:

- `inbound.{tenantId}.{appId}.{actorType}.{actorId}`
- `outbound.{tenantId}.{sessionId}`
- `control.{tenantId}.>`

The most important rule is:

- tenant runtimes only get credentials for their own tenant subjects

NATS is shared transport, not shared execution.

## Dedicated Runtime Layer

Each tenant should get dedicated actor runtime processes.

Those runtimes should:

- load only that tenant's bundle
- consume only that tenant's inbound subjects
- emit only that tenant's outbound subjects
- hold only that tenant's hot actor state
- store snapshots under that tenant's namespace

This is the core v1 isolation boundary and the reason Firecracker is not required yet.

## Security Rules

This setup only works if a few rules are enforced everywhere:

- every routing key includes `tenantId`
- the gateway derives tenant from hostname, not from client payload alone
- auth config is loaded per tenant
- runtime credentials are scoped to one tenant
- bundle references and any stored file references are tenant-scoped
- logs and admin APIs always carry tenant context

Without these rules, shared infrastructure becomes dangerous quickly.

## What This Defers

V1 intentionally defers:

- per-tenant gateway fleets
- per-tenant NATS clusters
- custom domain automation
- advanced multi-environment routing
- built-in auth-provider features beyond token verification
- stronger code sandboxing

That is a good tradeoff for the MVP.

## Short Version

If someone asks how v1 auth and tenancy work, the answer is:

- every customer gets `tenant.zocket.io`
- the gateway resolves tenant from the hostname
- auth is verified in that tenant's context
- NATS is shared but all subjects are tenant-scoped
- each tenant gets dedicated actor runtimes
- this gives useful tenant separation without requiring Firecracker yet
