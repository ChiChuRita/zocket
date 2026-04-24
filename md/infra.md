# Infrastructure

Zocket is multi-tenant actor infrastructure for TypeScript realtime products.

The infrastructure exists to host and operate message-driven stateful actors. It
should be infrastructure-credible without becoming a generic compute platform.

## V1 Shape

V1 should be simple and credible.

The intended shape is:

- Cloudflare for public DNS, docs, and platform hosting
- shared Bun gateway fleet
- shared NATS / JetStream
- dedicated actor runtimes per project
- Neon Postgres as the platform system of record
- S3-compatible storage for deployment bundles
- Pulumi-managed AWS runtime infrastructure when hosted runtimes are enabled

This is enough to get useful isolation without taking on full sandboxing or
microVM complexity.

## Core Model

The core platform model is:

- developers deploy versioned actor bundles
- end users connect over WebSockets
- actors are addressed by `(workspaceId, projectId, actorType, actorId)`
- each actor processes messages sequentially
- the platform handles routing, lifecycle, deployment metadata, and runtime status

The important rule is that actors are still message-driven stateful handlers.
They are not generic compute containers.

## Main Planes

The platform naturally splits into four planes.

### Gateways

Gateways terminate client connections and handle:

- auth and session lifecycle
- host-based project resolution
- publishing actor calls into JetStream
- forwarding outbound events and state updates

Gateways should stay stateless or near-stateless. They are shared ingress, not
actor hosts.

### Actor runtimes

Actor runtimes are where project code actually runs.

They handle:

- loading deployment bundles
- registering actor-type consumers
- activating actors lazily
- sequential method execution
- hot in-memory state
- event and patch emission

This is the most important execution boundary in the system.

### Placement

Placement decides which runtime owns a given project or actor.

V1 can stay simple:

- one runtime service per project
- desired count `1` by default
- manual sizing before autoscaling

Over time this can become:

- stable actor ownership
- actor migration
- rebalance support
- better runtime capacity awareness

The product does not need a complicated placement system before the core deploy
and runtime loop works end to end.

### Control plane

The control plane manages:

- users and workspaces
- projects and domains
- deploy tokens and CLI tokens
- deployment metadata
- auth configuration
- runtime configuration and status
- bundle storage references

The current control plane is a TanStack Start app on Cloudflare Workers with an
Elysia API, Neon/Drizzle data layer, and S3-compatible bundle storage.

## Transport

WebSockets are the main client transport.

Clients should be able to:

- connect once
- call actor methods
- subscribe to events
- subscribe to state over time
- reconnect cleanly

Internally, NATS and JetStream handle routing and short-lived buffering.

The important boundary is:

- NATS is transport and buffering
- Neon is the platform source of truth
- actor state is currently hot in memory
- JetStream is not a complete durability story by itself

## Durability And State

The current durability model is intentionally limited:

- hot actor state lives in runtime memory
- deployment metadata lives in Neon
- deployment bundles live in S3-compatible storage
- inbound and outbound messages use JetStream with short retention

This is enough for the current MVP path, but it should not be marketed as durable
execution. Stronger snapshots, restore, and actor migration belong in later work.

## V1 Versus End State

V1 should prove:

- the actor model
- the gateway to runtime path
- deploy and release flow
- workspace/project-aware routing
- enough observability for real users
- a clear failure mode when hosted runtime orchestration is incomplete

The end state can later grow into:

- more advanced placement
- stronger tenant isolation
- snapshots and restore
- richer reconnect and resume behavior
- multiple runtime hosts per project
- better deploy rollback and smoke testing

That evolution is fine as long as the product stays recognizable.

## Product Boundary

The most important infrastructure decision is what not to become.

Zocket should avoid becoming:

- generic background compute
- freeform container infrastructure
- a catch-all platform for jobs, workflows, agents, and arbitrary execution

The cleaner story is:

- message-driven actors
- realtime application state
- typed client interaction
- hosted routing and runtime lifecycle

## Takeaway

The infrastructure should make actor-based realtime products easier to ship, not
broaden Zocket into every backend category.

The right mental model is:

- define actors
- deploy a version
- connect clients
- let the platform handle routing, lifecycle, and state fanout
