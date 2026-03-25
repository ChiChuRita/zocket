# Zocket Infrastructure Vision

This document describes the end-state infrastructure idea for Zocket, not just the current local prototype.

## Summary

Zocket is a multi-tenant actor platform for realtime applications.

The core model is:

- developers deploy versioned actor bundles
- end users connect over WebSockets
- actor instances are addressed by `(tenant, app, actorType, actorId)`
- each actor processes messages sequentially
- actor state can be snapshotted and restored
- the platform handles placement, routing, lifecycle, and release management

The mental model is closer to "Vercel for realtime stateful apps" than to a raw socket server.

## Core Concepts

### Tenant bundle

Each tenant deploys code as a versioned bundle.

A bundle defines:

- actor classes or actor definitions
- runtime compatibility version
- the bundle entrypoint
- any tenant-specific business logic

Deployments are immutable artifacts. Activating a release switches a tenant/app to a specific deployment version.

### Actor identity

Actors are stateful compute units addressed by:

- `tenantId`
- `appId`
- `actorType`
- `actorId`

Examples:

- `room/general`
- `presence/main`
- `match/abc123`
- `conversation/user-42`

### Actor execution model

Each actor has:

- single-writer execution
- a durable sequential mailbox backed by JetStream
- lazy activation
- optional lifecycle hooks
- optional snapshot/restore

This is the main concurrency guarantee: one actor executes one message at a time, while different actors can run independently.

The mailbox is a JetStream consumer with explicit ack and max one in-flight message. This makes the mailbox durable and independent of the runtime process — messages survive crashes, and actor ownership can move between runtimes without a message handoff protocol.

## End-State Architecture

The system is split into four major planes.

### 1. Gateway layer

Gateways terminate client WebSocket connections.

Responsibilities:

- auth and connection lifecycle
- subscription tracking
- publishing method calls to JetStream actor subjects
- consuming outbound JetStream streams and forwarding to clients
- event and state fanout

Gateways are stateless or near-stateless. They should not own actor state. Gateways do not need to know which runtime owns a given actor — they publish to JetStream and the owning runtime picks it up.

### 2. Actor runtime layer

Actor runtimes are Bun processes that host hot actor instances.

Responsibilities:

- load the active tenant bundle
- register actor types
- lazily instantiate actors
- process actor mailboxes
- emit events and state updates
- snapshot and restore actors
- evict idle actors

A runtime owns actor execution, not just transport.

### 3. Placement and routing layer

Placement decides which runtime owns a given actor instance.

Responsibilities:

- map actor keys to runtime hosts
- keep ownership stable when possible
- support scaling and rebalance
- help gateways route traffic correctly

In the simplest model, placement can be consistent hashing over runtime capacity. Over time this can evolve into a more explicit actor ownership service.

Because actor mailboxes are durable JetStream streams, rebalancing is straightforward: stop the consumer on the old runtime, start a consumer on the new runtime. Messages queue safely in between with no handoff protocol required.

### 4. Control plane

The control plane manages tenants, deployments, releases, scaling, and metadata.

Responsibilities:

- build and validate deployment artifacts
- store bundle versions
- activate and roll back releases
- start or recycle tenant runtimes
- track placement and health
- collect logs, metrics, and runtime metadata

This is the plane that makes the platform operable, not just executable.

## Networking and Transport

### Client transport

The intended client transport is WebSockets.

Clients should be able to:

- connect once
- invoke actor methods
- subscribe to events
- subscribe to actor state
- receive snapshots and patches
- reconnect and resume from where they left off

Reconnection is backed by the outbound JetStream buffer. The client SDK tracks the last received sequence number. On reconnect, the client presents its session ID and last sequence, and the gateway resumes delivery from that point. This avoids full state re-snapshots on every reconnect.

HTTP remains useful for control APIs, admin APIs, deploy APIs, and debugging endpoints.

### Internal transport

NATS is the intended internal routing fabric. JetStream is used for durable message delivery in both directions.

Use NATS core pub/sub for:

- placement and ownership signaling
- release activation notifications
- runtime coordination

Use JetStream for two symmetric durable paths:

**Inbound (actor mailbox):** Gateways publish method calls to JetStream. Streams live in the NATS cluster, not on any runtime. One stream per actor type per tenant/app, with subjects like `actors.{tenant}.{app}.{type}.{id}`. Actors of the same type share a stream but each actor instance gets its own filtered consumer scoped to its subject, with explicit ack and max one in-flight message to preserve sequential execution.

Gateways do not need to know which runtime owns an actor. They just publish to the actor's JetStream subject. The owning runtime — as determined by the placement layer — is the one that creates and holds the consumer for that actor. This fully decouples gateways from placement on the inbound path. When placement moves an actor, the old runtime drops its consumer and the new runtime creates one. Messages queue safely in between.

**Outbound (client delivery buffer):** Runtimes publish responses, events, and state patches to JetStream. Gateways consume and forward to WebSocket clients. One stream per tenant/app for outbound traffic, with subjects like `outbound.{tenant}.{app}.{sessionId}`. Each client session is a consumer filtered to its session ID. Short retention window (enough to survive reconnects). If a client is disconnected longer than the retention window, it falls back to a full state snapshot.

This means neither side needs the other to be alive at the exact moment a message is produced. Messages buffer durably in JetStream and are consumed when the receiver is ready.

NATS is transport and signaling infrastructure. JetStream provides durable delivery. Neither is the source of truth for actor ownership or actor state.

## Isolation Model

The long-term direction is stronger tenant isolation than a single shared process.

Expected evolution:

1. Single-process local development
2. One logical tenant runtime per tenant/app
3. Multiple tenant runtimes per host with stronger process isolation
4. Optional microVM or stronger sandbox isolation for untrusted code

The important platform boundary is tenant code isolation plus deterministic actor execution.

## Deployment Model

### Build and artifact flow

Deployment should look like:

1. tenant source bundle is submitted
2. control plane validates compatibility
3. bundler produces an immutable artifact
4. artifact is stored in versioned object storage
5. release metadata is written
6. tenant/app can activate that version

### Release activation

Activating a release should:

- mark one deployment version active for a tenant/app
- notify affected runtimes
- reload code on next activation or perform controlled restart
- preserve actor durability where possible

Deployments are immutable. Releases are pointers.

## Actor Lifecycle

The intended lifecycle for an actor instance is:

1. client or service targets `(tenant, app, actorType, actorId)`
2. gateway publishes message to the actor's JetStream subject
3. placement resolves the owning runtime
4. runtime checks if actor is already hot
5. if cold, runtime loads snapshot and activates actor
6. runtime's JetStream consumer delivers the message
7. actor processes the message and acks
8. runtime emits events or state changes to the outbound JetStream stream
9. runtime snapshots when needed
10. actor is evicted after idle timeout

This gives the platform natural durability and elasticity without requiring every actor to stay hot forever.

## Durability and State

Actor state should support:

- in-memory hot state for active actors
- persisted snapshots for cold restore
- release metadata for version tracking
- optional event or audit streams for observability

The likely storage split is:

- object/blob storage for bundle artifacts
- metadata store for tenants, apps, releases, placement, and runtime health
- snapshot store for actor durability

Different actors may eventually need different durability policies, but the platform baseline is snapshot/restore.

## State Sync Roadmap

The intended UX evolves in stages:

1. Event subscriptions
2. Full state snapshots on subscribe
3. Incremental state patches
4. Selector-based subscriptions in client libraries

The ideal developer experience is:

- actor methods mutate server-side state
- the platform pushes only the relevant deltas
- clients consume state like a local store

## Scaling Model

Scaling should happen across three dimensions.

### Gateway scaling

Scale WebSocket gateways horizontally to handle more connections.

### Runtime scaling

Scale actor runtimes horizontally to handle more hot actors and more compute load.

### Placement scaling

Move actor ownership as capacity changes while minimizing disruption and preserving actor identity.

The platform should be able to add runtime hosts without changing the application model.

## Product Shape

The end goal is not just a library. It is a hosted or hostable runtime platform with:

- typed actor development model
- deployable tenant bundles
- managed realtime transport
- actor durability and lifecycle
- operational control plane

Developers should think in terms of:

- defining actors
- deploying versions
- calling actors from clients
- subscribing to state and events

They should not have to manually build socket protocols, routing, or state fanout.

## Why This Matters

The thesis is that many realtime products map naturally to actors:

- chat rooms
- multiplayer matches
- collaborative docs
- AI conversations
- agent runs
- dashboards and live workflows

Actors give:

- natural identity
- ordered execution
- easier concurrency reasoning
- durable state boundaries
- a clean mapping from app concepts to runtime units

## Non-Goals For The End Idea

The infrastructure vision does not assume:

- one actor per machine
- actor ownership inside the client
- NATS as the database
- gateways storing durable actor state
- raw WebSocket handler code as the developer-facing model

The platform should hide those concerns behind the actor abstraction.

## MVP: Standalone Docker Compose

Before tackling multi-tenancy, isolation, or distributed placement, the first real milestone is a standalone single-tenant deployment that proves the core architecture end-to-end.

### What it is

A `docker-compose.yml` that starts three services:

1. **NATS** — with JetStream enabled, single node
2. **Gateway** — a Bun process that terminates WebSocket connections, publishes inbound messages to JetStream, consumes the outbound stream, and forwards to clients
3. **Actor Runtime** — a Bun process preloaded with one tenant's actor bundle, creates JetStream consumers for actors it owns, processes mailboxes, publishes to the outbound stream

### What it proves

- the full message flow: client → WebSocket → gateway → JetStream → runtime → JetStream → gateway → client
- JetStream as the actor mailbox with sequential delivery
- JetStream as the outbound buffer with reconnect resumption
- gateway fully decoupled from runtime (they only communicate through NATS/JetStream)
- actor lifecycle: lazy activation, mailbox processing, state snapshots
- the developer-facing model works end-to-end (define actors, call methods, subscribe to state)

### What it defers

- multi-tenancy (single tenant bundle baked into the runtime)
- placement (single runtime owns all actors, no placement decisions needed)
- tenant isolation (no process or VM boundaries)
- control plane (no deploy API, no release management, bundle is loaded at startup)
- horizontal scaling (one gateway, one runtime)

### Service topology

```
┌──────────┐       WebSocket       ┌──────────┐
│  Client  │ ◄──────────────────► │  Gateway  │
└──────────┘                       └────┬──┬───┘
                                        │  │
                              publish to │  │ consume from
                              inbound    │  │ outbound
                              subjects   │  │ stream
                                        │  │
                                   ┌────▼──▼───┐
                                   │    NATS    │
                                   │ (JetStream)│
                                   └────┬──┬───┘
                                        │  │
                              consume    │  │ publish to
                              inbound    │  │ outbound
                              subjects   │  │ stream
                                        │  │
                                   ┌────▼──▼────┐
                                   │   Actor    │
                                   │  Runtime   │
                                   │ (single    │
                                   │  tenant)   │
                                   └────────────┘
```

### Configuration

The runtime loads the tenant bundle from a mounted volume or baked-in path. JetStream streams and consumers are created on startup by the runtime and gateway. No external database or object storage is needed — snapshots can write to a local volume.

### Why this is the right first step

It validates the core architecture (gateway ↔ JetStream ↔ runtime) without any of the distributed systems complexity. If this works, adding placement, multi-tenancy, and horizontal scaling are layered on top of proven primitives. If this doesn't work, nothing else matters.

## Current Prototype Relation

The local prototype is the proof point before the MVP.

It proves:

- bundle packaging
- version activation
- actor lifecycle
- mailbox sequencing
- snapshot persistence

The MVP builds on this by splitting into separate gateway and runtime processes connected through JetStream, proving the real architecture end-to-end.
