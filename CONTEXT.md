# Zocket — Project Context

## Core Idea

Zocket is **"Vercel for realtime"** — a typed actor runtime for realtime applications.

**Tech stack:** Bun, WebSockets, NATS.

Instead of thinking in raw sockets (`socket → message → handler`), developers think in **stateful actors** (`actor instance → method → state change → events`).

```ts
const room = client.actor(ChatRoom, "general")
await room.sendMessage(...)
room.on("message", ...)
```

## Why Actors

Actors provide single-writer state, ordered execution, natural identity, and easy concurrency reasoning.

| Use case            | Actor          |
| ------------------- | -------------- |
| Chat room           | `ChatRoom`     |
| Multiplayer game    | `Match`        |
| AI conversation     | `Conversation` |
| Collaborative doc   | `Document`     |
| Agent run           | `AgentRun`     |

## Differentiator vs PartyKit / Supabase / Convex

PartyKit is realtime infrastructure (rooms as compute units, socket-first, manual protocol management). Zocket aims to be a **stateful realtime application runtime** — a full framework with typed methods, events, and actor lifecycle, not just transport.

## v1 Scope

A typed actor runtime that provides:

- Actor definitions
- Actor instances by ID
- Typed methods
- Realtime events
- WebSocket transport
- Simple deployment

Everything else (auth, persistence, AI orchestration, state sync, deploy platform) comes later.

## Developer API

### Server

```ts
const ChatRoom = actor({
  state: z.object({
    members: z.array(z.string()),
    messages: z.array(Message),
  }),

  methods: {
    sendMessage: {
      input: MessageInput,
      handler: async ({ state, emit, input }) => {
        const msg = { ...input, sentAt: Date.now() }
        state.messages.push(msg)
        emit("message", msg)
      }
    },
    getSnapshot: {
      handler: async ({ state }) => state
    }
  },

  events: {
    message: Message
  }
})
```

### Client

```ts
const room = client.actor(ChatRoom, "general")

await room.sendMessage({ text: "hello" })

room.on("message", msg => {
  console.log(msg)
})
```

This is essentially **tRPC + actors + realtime events**.

## Backend Architecture

### Components

1. **Gateway** — WebSocket connections, auth, client subscriptions, forwards method calls.
2. **Actor runtimes** — Bun processes that host actor instances, process method calls sequentially, emit events.
3. **Placement system** — Decides which runtime owns an actor instance.
4. **Control plane** — Deployments, scaling, metadata, logging.

### Actor Instance Model

Each runtime hosts a `Map<ActorKey, ActorInstance>`. Each instance contains:

- State
- Invocation queue (one call at a time)
- Subscribers
- Lifecycle info

### Scaling

**v1:** Single Bun process, all actor instances in-memory. No distributed complexity.

**Later:** Gateway nodes, runtime nodes, NATS for routing, actor ownership via consistent hashing (`hash(actorKey) % runtimeCount`).

## NATS Usage

NATS handles gateway↔runtime calls, runtime→gateway events, internal signaling, and scaling coordination. NATS is transport only — not actor ownership.

## State Subscription Roadmap

**v1 — Event-based (simplest):**
```ts
emit("message", msg)
room.on("message", ...)
```

**v2 — Snapshot subscription:**
```ts
room.subscribeState(...)
```

**v3 — Zustand-style selectors (best DX):**
```ts
const messages = room.useSelector(s => s.messages)
```

Server sends patches/snapshots, client keeps a local store, selectors run locally. React-friendly realtime state.

## Key Strategic Question

What is the first killer use case that makes developers choose Zocket?

Candidates: multiplayer apps, AI conversations, collaborative tools, realtime dashboards, agent workflows.

## Project Structure

- `packages/` — New Zocket v2 packages (to be built)
- `old/` — Previous implementation (typed WebSocket library, tRPC-for-sockets style)
- `docs/` — Documentation site (Astro Starlight)
