# Features

This note is the product-facing backlog for capabilities that strengthen the core Zocket loop.

The bar for new features should be simple:

- does this make typed realtime apps meaningfully easier to build?
- does it strengthen the actor model instead of weakening it?
- does it improve the end-to-end loop from backend actor to client UX?

If not, it is probably not a priority.

## Highest-Leverage Additions

These are the features that most directly strengthen the product thesis.

### State sync and selectors

Zocket should move from event-only updates toward a real state-sync story.

The likely progression is:

1. event subscriptions
2. snapshots on subscribe
3. incremental patches
4. selector-style client APIs

This is one of the biggest product opportunities because it turns actors into a natural client state primitive, not just a server abstraction.

### Targeted events and connection tracking

Actors need a way to address one connection instead of broadcasting everything.

This matters for:

- multiplayer games
- private messages
- permission-aware UX
- user-specific errors and prompts

The basic model should be:

- `emit()` for broadcast
- targeted emit for one connection
- read-only connection tracking in actor context

This keeps shared state public while still allowing private per-user events.

### Timers and cron

Actors need first-class delayed and recurring work.

This matters for:

- game countdowns
- timeouts
- cleanup jobs
- reservations
- heartbeat and presence logic

The important design rule is that timers should feed back through the actor's normal sequential queue. That preserves the single-writer model instead of creating side channels.

### Actor-to-actor calls

Actors should be able to coordinate directly.

This unlocks:

- lobbies creating matches
- orchestration actors delegating work
- shared domain logic across actor types
- tool and worker patterns for AI systems

The main caution is that this should stay aligned with message-driven execution. It should not become an excuse to turn actors into generic service containers.

### Streaming methods

Long-running methods need to stream state changes before completion.

This matters most for:

- AI generation
- multi-step workflows inside one actor
- file and processing jobs with progress

The product value is straightforward: the client sees state evolve while work is in progress instead of waiting for one final patch.

## AI-Specific Layer

AI is a useful wedge only if it strengthens the main product loop.

The right angle is:

- stateful conversations
- multi-user AI sessions
- actor-backed tool execution
- client APIs that still feel familiar

This is why AI SDK integration is attractive. It lets developers keep established client-side patterns while moving the backend to actor-based stateful execution.

## What To Be Careful About

Some features look attractive but can quietly pull the product off course.

Be careful with:

- generic workflow primitives
- detached background execution that is not actor-centric
- low-level escape hatches that reintroduce transport complexity
- infrastructure-heavy features before the client experience is clearly better

If a feature adds power but weakens the mental model, it is probably a bad trade.

## Prioritization

If the goal is to strengthen the product quickly, the best order is likely:

1. state sync and selectors
2. targeted events and connection tracking
3. timers and cron
4. streaming methods
5. actor-to-actor coordination
6. AI-specific integrations built on top of the above

That order keeps the product centered on realtime app DX instead of drifting into generic orchestration.

## Working Rule

The roadmap should keep asking one question:

Does this make Zocket feel like the obvious way to build a realtime app?

That is the filter this note should apply.
