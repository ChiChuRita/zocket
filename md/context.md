# Context

Zocket is TypeScript-native actor infrastructure for realtime products.

The product idea is simple:

- define an actor
- call it from the client with full types
- subscribe to events and state changes
- deploy without building your own socket runtime

The short description is:

Zocket is "Vercel for realtime actors."

## Core Model

Zocket asks developers to model realtime systems as addressable stateful actors
instead of raw sockets or global event handlers.

Instead of:

- open a websocket
- define message types
- route messages manually
- keep state in sync by hand

the model is:

- address an actor by ID
- call typed methods
- let the actor own state
- stream events and state changes back to clients
- let the platform route sessions and deployments

The natural mapping is strong for:

- chat rooms
- multiplayer matches
- collaborative documents
- AI conversations
- agent sessions

## Product Thesis

The current company direction is actor infrastructure for TypeScript teams, not
just a local realtime library.

That does not mean becoming generic compute. The product should stay centered on:

- typed actors
- stateful realtime application backends
- built-in state and event subscriptions
- TypeScript and React client ergonomics
- a hosted deploy path for teams that do not want to operate gateways, NATS, and runtimes

The product should feel like an app framework plus managed actor platform, not a
freeform jobs, workflows, and containers platform.

## Current Stack

The current implementation has two layers.

Library layer:

- Bun-first TypeScript monorepo
- `@zocket/core` for actor definitions and protocol types
- `@zocket/server` for the in-process actor runtime and Bun adapter
- `@zocket/client` for WebSocket RPC, reconnect, state sync, and handles
- `@zocket/react` for provider and hooks
- Zod / Standard Schema for runtime validation
- Immer JSON patches for state updates

Hosted layer:

- `@zocket/gateway` as the WebSocket ingress process
- `@zocket/runtime` as the NATS-connected actor runtime process
- NATS / JetStream as the internal message fabric
- TanStack Start dashboard on Cloudflare Workers
- Elysia control-plane API mounted under `/api`
- WorkOS AuthKit for dashboard auth
- Neon Postgres with Drizzle for platform data
- S3-compatible storage for deployment bundles
- Pulumi for Cloudflare, Neon, AWS, and per-project runtime infrastructure

## V1 Scope

V1 should prove the hosted actor loop:

- create an account
- create a project
- get a deploy token
- deploy an actor bundle
- connect clients over WebSockets
- route messages through gateway -> NATS -> runtime -> actor
- surface deployment status clearly

The current caveat is important: project runtime orchestration is not fully wired
in the platform app yet. `platform/src/server/deploy.ts` still throws, so hosted
deploys can store metadata and bundles but cannot automatically create or update
project runtimes end to end.

## Target Use Cases

The strongest early users are TypeScript teams building realtime products where
stateful server-side coordination matters.

Best candidates:

- multiplayer and game backends
- chat and community products
- collaborative tools
- AI conversation and agent-session products

These all benefit from the same primitives:

- long-lived identity
- ordered execution
- workspace/project-aware routing
- client subscriptions tied to changing state
- typed method calls from the frontend

## Architecture Shape

The current system shape is:

1. Cloudflare serves docs and platform, and owns public DNS.
2. Gateways terminate WebSocket connections and authorize sessions through the control plane.
3. NATS / JetStream carries inbound actor messages and outbound session messages.
4. Actor runtimes load project bundles and execute actor methods sequentially.
5. The platform stores users, workspaces, projects, deployments, auth config, and runtime metadata.

The important rule is:

- NATS is transport and buffering
- actors are the compute model
- Neon is the platform system of record
- S3-compatible storage holds deployment bundles
- AWS hosts runtime infrastructure when enabled

## Repos And Boundaries

At a high level:

- `packages/` is the current implementation surface
- `platform/` is the hosted dashboard and control plane
- `infra/` is Pulumi-managed infrastructure
- `docs/` is the public documentation site
- `old/` is prior implementation history
- `md/` is the strategy and architecture note system

This note should stay short. If a topic needs depth, it should live in its own
note under `md/`.
