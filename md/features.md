# Features

This note is the product-facing backlog for capabilities that strengthen the
current Zocket direction: TypeScript-native actor infrastructure for realtime
products.

The bar for new features should be simple:

- does this make hosted actors more useful for realtime products?
- does it strengthen the actor model instead of weakening it?
- does it improve the end-to-end loop from actor bundle to client UX?
- does it make the infrastructure more credible without broadening into generic compute?

If not, it is probably not a priority.

## Already In The Current Core

These are no longer future bets; they exist in the current packages and should
be treated as the baseline product surface:

- actor definitions with state, methods, events, and lifecycle hooks
- sequential method execution per actor instance
- typed client handles inferred from `createApp(...)`
- RPC over WebSocket with request IDs and timeouts
- event subscriptions with `emit(...).broadcast()`, `.to(...)`, and `.except(...)`
- state snapshots and JSON patch updates
- React provider and hooks: `useActor`, `useActorState`, `useEvent`, `useConnectionStatus`
- middleware for method calls
- gateway/runtime split over NATS / JetStream
- CLI auth/init/link/deploy basics

The docs and roadmap should not describe these as unbuilt.

## Highest-Leverage Additions

These are the features that most directly strengthen the current thesis.

### Per-client subscription authorization

State and event subscriptions need a server-side authorization surface.

This matters for:

- multi-tenant apps
- private rooms
- multiplayer games
- admin-only events
- state that contains server-only details

The likely API shape is:

- `internalState` for data that is never subscribable
- `subscribableState({ state, ctx })` for per-subscriber projections
- `canSubscribeEvents({ ctx, event })` for event subscription gates
- an explicit targeted emit escape hatch for advanced cases

This is the most important product/security gap before serious external use.

### Deployment rollback and smoke tests

Hosted actor infrastructure needs a credible deploy loop.

The CLI/platform path should support:

- bundle
- upload
- create deployment record
- start or update runtime
- smoke test runtime health
- switch active deployment
- rollback to the previous deployment

Without this, the hosted story is too fragile for design partners.

### Structured logs and request IDs

The distributed stack needs request IDs from gateway through NATS to runtime.

This matters for:

- debugging failed actor calls
- customer support
- incident review
- deployment health
- future metrics and tracing

Plain `console.log` is acceptable for examples, not for the hosted runtime path.

### Timers and cron

Actors need first-class delayed and recurring work.

This matters for:

- game countdowns
- timeouts
- cleanup jobs
- reservations
- heartbeat and presence logic

The important design rule is that timers feed back through the actor's normal
sequential queue. That preserves the single-writer model instead of creating
side channels.

### Streaming methods and streaming RPC

Long-running methods need to stream progress before completion.

This matters most for:

- AI generation
- multi-step workflows inside one actor
- file and processing jobs with progress

The product value is straightforward: clients see state or return chunks evolve
while work is in progress instead of waiting for one final result.

### Actor-to-actor calls

Actors should be able to coordinate directly.

This unlocks:

- lobbies creating matches
- orchestration actors delegating actor-shaped work
- shared domain logic across actor types
- tool and worker patterns for AI systems

The caution is that this should stay aligned with message-driven execution. It
should not become a generic service-container API.

## AI-Specific Layer

AI is a useful wedge only if it strengthens the main actor product loop.

The right angle is:

- stateful conversations
- multi-user AI sessions
- actor-backed tool execution
- client APIs that still feel familiar

AI SDK integration is attractive because it lets developers keep established
client-side patterns while moving the backend to actor-based stateful execution.

## What To Be Careful About

Some features look attractive but can quietly pull the product off course.

Be careful with:

- generic workflow primitives
- detached background execution that is not actor-centric
- low-level escape hatches that reintroduce transport complexity
- infrastructure-heavy features before the deploy loop is reliable
- claims about durability, migration, or isolation that the current runtime cannot meet

If a feature adds power but weakens the mental model, it is probably a bad trade.

## Prioritization

If the goal is to make the hosted stack credible for design partners, the best
order is likely:

1. per-client subscription authorization
2. structured logs and request IDs
3. deploy smoke tests and rollback
4. workspace/project-scoped runtime keys and routing hardening
5. timers and cron
6. streaming methods and streaming RPC
7. actor-to-actor coordination
8. AI-specific integrations built on top of the above

That order keeps the product centered on realtime actor infrastructure instead
of drifting into generic orchestration.

## Working Rule

The roadmap should keep asking one question:

Does this make Zocket feel like the obvious actor infrastructure for TypeScript
realtime products?

That is the filter this note should apply.
