# Competition Notes

## Rivet

Rivet is the clearest current comparison point.

Their actors product is already broad and serious:

- stateful actors
- realtime communication
- persistence
- queues and workflows
- low-level HTTP and WebSocket handling
- SQLite support
- Drizzle integration
- strong infrastructure/platform framing

Relevant docs:

- [Rivet Actors Overview](https://rivet.dev/docs/actors/)
- [Rivet SQLite + Drizzle](https://rivet.dev/docs/actors/sqlite-drizzle)

## Are We Cooked?

No.

But the market is more competitive than it first appeared, and the obvious "build generic actor infra" path is weak.

If Zocket tries to compete as:

- another general-purpose actor platform
- another runtime abstraction
- another durable compute system

then Rivet already has a head start and a much wider surface area.

That is not the best path.

## Where Zocket Can Still Win

Zocket should not primarily compete on infrastructure breadth.

It should compete on developer experience and product focus.

The strongest wedge is:

- typed realtime application platform
- actor-first application model
- end-to-end type safety
- great client SDKs
- first-class state sync
- excellent React integration
- simple deploy experience

In other words:

Rivet looks like powerful actor infrastructure.

Zocket should feel like the best way to build a realtime app.

## Good Positioning

### Rivet

Broad actor runtime platform.

Strong for teams that want flexible, lower-level primitives and infrastructure power.

### Zocket

Opinionated framework + platform for building typed realtime apps fast.

Strong for teams building:

- chat
- multiplayer
- collaborative tools
- AI conversations
- realtime dashboards
- agent workflows

## The Important Difference

The key distinction should be:

- Rivet: actor infrastructure
- Zocket: realtime application framework and platform

That means Zocket should emphasize:

- define actor once
- typed client methods out of the box
- automatic subscriptions and state sync
- React hooks that feel native
- minimal socket/protocol work
- deployment that feels productized, not infrastructural

## What Not To Do

Do not try to win by matching Rivet feature-for-feature.

That means avoiding a roadmap defined by:

- every infra primitive they have
- every durability mode they have
- every generic escape hatch they have
- generic "we also support actors" messaging

That is a losing comparison because it forces Zocket into their frame.

## What To Do Instead

### 1. Pick a wedge

Lead with one or two killer use cases, not all actor use cases.

Best candidates:

- chat and community apps
- multiplayer and game backends
- collaborative and shared-state tools
- AI conversation and agent-session apps

### 2. Make DX the whole product

The product needs to feel radically easier than assembling:

- WebSockets
- RPC
- state sync
- subscriptions
- reconnection
- typed clients
- presence

If the user still has to think in transport and protocol details, the wedge is weak.

### 3. Own the client side

This is likely the biggest opening.

If Zocket becomes the best actor client experience for:

- TypeScript
- React
- selectors
- event subscriptions
- optimistic UI patterns

then it is no longer just "another actor runtime."

### 4. Make the deploy story feel obvious

The platform should feel like:

- define actors
- deploy
- connect clients
- get durable realtime behavior

not:

- learn a runtime product
- wire your own transport
- reason about low-level actor hosting

## Suggested Messaging

Bad:

- "Distributed actor infrastructure"
- "Durable actors platform"
- "General actor runtime"

Better:

- "Typed actors for realtime apps"
- "The fastest way to build multiplayer and collaborative backends"
- "End-to-end typed realtime state over WebSockets"
- "Vercel for realtime applications"

## Strategic View

Rivet is a good sign, not just a threat.

It validates that:

- actor-based infrastructure is real
- developers want stateful realtime compute
- this category is becoming important

The existence of a strong competitor means Zocket has to be sharper.

It does not mean Zocket is dead.

## Current Takeaway

The best move is:

- stop thinking "generic actor platform"
- double down on "best developer product for typed realtime apps"
- make client DX, subscriptions, and state sync the center of the product
- let infrastructure exist to support that experience, not define it

