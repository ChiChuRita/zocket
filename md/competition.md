# Competition

The market is real, but the comparison only works if Zocket stays in the right
frame.

The old frame was:

- typed realtime app framework
- better WebSocket DX
- app-level state sync

The current frame is sharper and more infrastructure-shaped:

- TypeScript-native actor infrastructure
- stateful realtime backend primitives
- typed client interaction
- productized hosted deployment

The wrong frame is still:

- generic compute
- generic durable jobs
- workflows, agents, actors, and containers in one runtime

## Rivet

Rivet is the clearest actor-infrastructure comparison.

It is strong on:

- stateful actors
- realtime communication
- persistence
- queues and workflows
- low-level HTTP and WebSocket handling
- broader infrastructure framing

This matters because Rivet already occupies the broad "actor infrastructure"
position.

Zocket should compete here, but not by matching Rivet's entire surface area.

The useful distinction is:

- Rivet is broader actor infrastructure
- Zocket should be the TypeScript-native actor platform for realtime products

That means Zocket has to be better on:

- inferred TypeScript APIs
- React client ergonomics
- state subscriptions and patches
- app-shaped actor examples
- simple deploy path for TS teams

Relevant docs:

- [Rivet Actors Overview](https://rivet.dev/docs/actors/)
- [Rivet SQLite + Drizzle](https://rivet.dev/docs/actors/sqlite-drizzle)

## Cloudflare Durable Objects And PartyKit

Cloudflare Durable Objects and PartyKit are important because they prove the
"one live object per room/session/entity" model.

They are strong on:

- edge placement
- durable object identity
- low operational burden
- natural room/session modeling
- Cloudflare ecosystem integration

The tradeoff is that teams buy into Cloudflare's runtime constraints and still
do more of their own protocol, typing, and state-sync work.

Zocket's distinction should be:

- less edge-first
- more TypeScript-contract-first
- more actor-method and state-subscription oriented
- self-hostable core with hosted infrastructure as the convenience path

## Trigger.dev

Trigger.dev competes from a different direction.

It is strong on:

- durable background jobs
- workflows
- agent execution
- scheduled work
- realtime updates around long-running tasks

This is not the same product shape as Zocket, but it competes for developer
attention if Zocket drifts into generic jobs and workflows.

The risk is product drift.

If Zocket starts becoming:

- a workflow engine
- a jobs platform
- a detached agent runtime

then it enters Trigger.dev's frame instead of strengthening its actor runtime
position.

Relevant docs:

- [Trigger.dev Docs](https://trigger.dev/docs)
- [Trigger.dev Product](https://trigger.dev/product)
- [Trigger.dev Realtime](https://trigger.dev/product/realtime)

## SpacetimeDB

SpacetimeDB is important because it competes for multiplayer and collaborative
apps.

It is strong on:

- database-native realtime sync
- relational data with ACID guarantees
- embedded logic inside the database
- strong game and multiplayer positioning

Its center of gravity is different from both Zocket and Rivet.

The clean distinction is:

- SpacetimeDB is a programmable realtime database
- Zocket is addressable actors plus typed application messaging

Relevant docs:

- [SpacetimeDB Home](https://spacetimedb.com/)
- [SpacetimeDB Docs](https://spacetimedb.com/docs/index)
- [SpacetimeDB Maincloud](https://spacetimedb.com/docs/2.0.0-rc1/how-to/deploy/maincloud/)

## What Not To Do

Do not let competitors define the roadmap.

That means avoiding:

- feature-for-feature Rivet chasing
- generic `run` primitives
- broad workflow orchestration
- messaging that tries to cover jobs, workflows, actors, agents, and compute all at once
- durability claims the current runtime cannot defend

That is how Zocket gets pulled into stronger competitors' categories.

## Where Zocket Can Win

Zocket should win on TypeScript focus and realtime actor ergonomics.

The strongest wedge is the combination of:

- typed actor model
- message-driven stateful backend design
- built-in subscriptions and state sync
- excellent TypeScript and React integration
- open source adoption and trust
- a hosted deploy flow that hides gateway, NATS, and runtime operations

In practice that means the product should feel like:

- define actor once
- deploy a bundle
- call methods from the client with types
- subscribe naturally
- avoid manual protocol and runtime work

## Positioning

The best positioning is narrow and infrastructure-credible.

Good:

- TypeScript-native actor infrastructure
- hosted actors for realtime products
- the fastest way to build multiplayer and collaborative backends in TypeScript
- end-to-end typed realtime state over WebSockets
- stateful message handlers with hosted routing and deployment

Bad:

- generic distributed compute
- generic workflow platform
- actor-shaped serverless without a strong client story

Not this:

- jobs, workflows, actors, agents, and background compute in one platform

## Takeaway

The competition is a useful constraint.

It says:

- the category is real
- there is demand for stateful actor infrastructure
- Zocket has to be sharper, not broader
- the TypeScript realtime wedge is the credible way in

The best move is to become the most natural actor infrastructure choice for
TypeScript realtime teams, not a catch-all compute platform.
