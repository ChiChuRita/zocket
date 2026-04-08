# Context

Zocket is a typed realtime application platform built around stateful actors.

The product idea is simple:

- define an actor
- call it from the client with full types
- subscribe to events and state changes
- ship without building your own socket protocol

The best short description is still:

Zocket is "Vercel for realtime."

## Core Model

Zocket asks developers to think in stateful actors instead of raw sockets.

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

The natural mapping is strong for:

- chat rooms
- multiplayer matches
- collaborative documents
- AI conversations
- agent sessions

## Product Thesis

The point of the product is not generic actor infrastructure.

It is a better way to build realtime apps with:

- typed methods
- addressable stateful backend units
- built-in subscriptions
- a strong TypeScript and React story
- a deployment model that feels productized

The product should feel closer to an app framework plus platform than to low-level socket infrastructure.

## V1 Scope

V1 should stay narrow.

It needs:

- actor definitions
- actor instances by ID
- typed method calls
- realtime events
- websocket transport
- a simple deploy story

It does not need to prove every future capability.

It is fine for auth, deep persistence, state sync, and control-plane breadth to be partial or follow later as long as the core loop is strong.

## Target Use Cases

The strongest early use cases are the ones where shared state and low-latency interaction matter immediately.

Best candidates:

- chat and community apps
- multiplayer and game backends
- collaborative tools
- AI conversation and agent-session apps

These all benefit from the same primitives:

- long-lived identity
- ordered execution
- natural concurrency boundaries
- subscriptions tied to changing state

## Current Architecture Shape

The current system shape is straightforward:

1. gateways terminate websocket connections and track sessions
2. actor runtimes host actor instances and execute methods sequentially
3. placement decides where actors live
4. the control plane manages deploys, metadata, and scaling

NATS is the internal transport between gateways and runtimes.

The important rule is:

- NATS is transport
- actors are the compute model
- the platform stays message-driven rather than turning into generic compute

## State And Client Experience

The long-term client experience should move beyond event-only APIs.

The likely progression is:

1. event subscriptions
2. snapshot subscriptions
3. incremental patches
4. selector-style client APIs

The real opportunity is not just backend actors. It is making the client side feel unusually good for realtime apps.

## Repos And Boundaries

At a high level:

- `packages/` is the new implementation surface
- `docs/` is the public documentation site
- `old/` is prior implementation history
- `md/` is the strategy and product note system

This note should stay short. If a topic needs depth, it should live in its own note under `md/`.
