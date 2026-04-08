# Competition

The market is real, but the comparison only works if Zocket stays in the right frame.

The wrong frame is:

- generic actor platform
- generic durable compute
- workflows, jobs, and agents in one umbrella runtime

The right frame is:

- typed actors for realtime apps
- message-driven stateful backend primitives
- strong client DX
- productized deployment

## Rivet

Rivet is the clearest actor-platform comparison.

It is strong on:

- stateful actors
- realtime communication
- persistence
- queues and workflows
- low-level HTTP and WebSocket handling
- broader infrastructure framing

This matters because Rivet already occupies the "powerful actor infrastructure" position.

Zocket should not try to beat it by matching infrastructure breadth.

The useful distinction is:

- Rivet is actor infrastructure
- Zocket should be the best way to build a realtime app

Relevant docs:

- [Rivet Actors Overview](https://rivet.dev/docs/actors/)
- [Rivet SQLite + Drizzle](https://rivet.dev/docs/actors/sqlite-drizzle)

## Trigger.dev

Trigger.dev competes from a different direction.

It is strong on:

- durable background jobs
- workflows
- agent execution
- scheduled work
- realtime updates around long-running tasks

This is not the same product shape as Zocket, but it competes for some of the same developer attention.

The risk is not direct product overlap. The risk is product drift.

If Zocket starts becoming:

- a workflow engine
- a jobs platform
- a detached agent runtime

then it enters Trigger.dev's frame instead of strengthening its own.

Relevant docs:

- [Trigger.dev Docs](https://trigger.dev/docs)
- [Trigger.dev Product](https://trigger.dev/product)
- [Trigger.dev Realtime](https://trigger.dev/product/realtime)

## SpacetimeDB

SpacetimeDB is important because it competes for multiplayer and collaborative apps.

It is strong on:

- database-native realtime sync
- relational data with ACID guarantees
- embedded logic inside the database
- strong game and multiplayer positioning

Its center of gravity is different from both Zocket and Rivet.

The clean distinction is:

- SpacetimeDB is a programmable realtime database
- Zocket should stay centered on addressable actors and typed application messaging

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

That is how Zocket gets pulled into stronger competitors' categories.

## Where Zocket Can Win

Zocket should win on product focus and developer experience.

The strongest wedge is the combination of:

- typed actor model
- message-driven stateful backend design
- built-in subscriptions and state sync
- excellent TypeScript and React integration
- open source adoption and trust
- a deploy flow that feels simple

In practice that means the product should feel like:

- define actor once
- call methods from the client with types
- subscribe naturally
- avoid manual protocol work

## Positioning

The best positioning is still narrow and opinionated.

Good:

- typed actors for realtime apps
- the fastest way to build multiplayer and collaborative backends
- end-to-end typed realtime state over WebSockets
- stateful message handlers for realtime apps

Bad:

- distributed actor infrastructure
- general actor runtime
- general stateful compute

Not this:

- jobs, workflows, actors, agents, and background compute in one platform

## Takeaway

The competition is a useful constraint.

It says:

- the category is real
- there is demand for stateful realtime systems
- Zocket has to be sharper, not broader

The best move is still to double down on typed realtime apps, not generic actor infrastructure.
