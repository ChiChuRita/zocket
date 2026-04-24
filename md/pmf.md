# Product Market Fit

Zocket should aim for product-market fit as TypeScript-native actor
infrastructure for realtime products.

The current direction is intentionally more infrastructure-shaped than the older
"typed realtime app DX" thesis. The sharper version is not generic compute. It is
managed, typed, stateful actors for teams building realtime applications.

## Thesis

The strongest version of the thesis is:

- TypeScript-first actor infrastructure
- stateful realtime backend primitives
- excellent client and React ergonomics
- open source core with a hosted deployment path
- hosted routing, gateway, runtime, and deployment management

The simple framing is:

Zocket is "Vercel for realtime actors."

## The Real User Problem

Teams building realtime products usually assemble too many moving parts:

- WebSockets
- RPC-style method calls
- subscriptions
- reconnection
- shared state sync
- presence
- client typing
- backend state ownership
- deployment and runtime routing

The pain is not only "I need actors."

The pain is:

- "I need a live backend object that clients can call directly."
- "I need state that stays server-authoritative and updates clients in realtime."
- "I do not want to operate my own gateway, message bus, and actor runtime."

That is the problem Zocket should solve.

## Best Early Users

The strongest early users are TypeScript teams that already know they need
realtime stateful infrastructure and are paying the cost of building it manually.

Best candidates:

- multiplayer and game backends
- chat and community products
- collaborative tools
- AI conversation and agent-session products

These all share the same useful shape:

- long-lived addressable state
- many clients reacting to the same changing entity
- method calls and subscriptions in the same mental model
- product value tied to low-latency UX
- enough backend complexity that a hosted actor runtime is attractive

## Where PMF Probably Fails

Zocket will struggle if it becomes too broad before the actor wedge is proven.

Weak frames:

- generic compute platform
- general workflow engine
- durable jobs platform
- agents, jobs, workflows, actors, cron, and containers under one umbrella

Those frames push Zocket into stronger competitors' categories:

- Rivet on broad actor infrastructure
- Trigger.dev on durable jobs and workflows
- SpacetimeDB on programmable realtime database and sync

The current bet is to compete closer to the actor-infrastructure category, but
with a narrower TypeScript realtime wedge.

## The Wedge

The wedge is the combination of:

- actor-first backend model
- end-to-end typing
- built-in realtime subscriptions
- state sync with patches
- React-friendly client APIs
- deployable hosted runtime
- open source adoption and trust

Open source matters because this is infrastructure-adjacent. Teams need to trust
the primitive, inspect it, self-host it if needed, and understand what happens
when the hosted platform is not enough.

The product wins if the whole loop feels natural:

1. define actors
2. deploy a bundle
3. connect clients
4. call typed methods
5. subscribe to state and events
6. let the platform handle routing and runtime lifecycle

## Signs Of PMF

The right signals are behavioral.

Strong signals:

- users reach a first multiplayer, chat, collaborative, or AI-session prototype quickly
- teams describe Zocket as replacing a hand-built socket/runtime layer
- subscriptions and typed client methods feel obvious without much explanation
- teams ask about hosting, tenancy, deployment, logs, and rollback
- early apps naturally map domain objects to actor IDs

Especially good signs:

- "We replaced a messy socket layer with this."
- "This gives us actors without operating actor infrastructure."
- "Our frontend team can call live backend objects without protocol glue."

## What Must Be Excellent

The product needs to be excellent in a few areas, not merely acceptable in many.

Critical areas:

- actor definition DX
- typed client inference
- subscriptions and state sync
- React integration
- local development
- deploy experience
- runtime observability
- workspace/project-aware routing and isolation

If the library DX is good but deploys, logs, tenancy, or failure handling are
weak, the infrastructure positioning will not hold.

## What To Avoid

Avoid infrastructure sprawl before the core actor platform is reliable.

Be careful about:

- generic `run` primitives
- detached workflow execution
- broad background-job semantics
- claiming durable execution before the runtime actually provides it
- adding low-level escape hatches before the main actor path is solid

The boundary should be clear: actors for realtime applications, not every kind of
stateful compute.

## Current Hypothesis

The best current hypothesis is:

Zocket can find product-market fit with TypeScript teams building multiplayer,
chat, collaborative, and AI-session products that want hosted stateful actors
without assembling WebSockets, subscriptions, state sync, routing, and runtime
infrastructure by hand.

That lines up with the current strategic advantage:

- stronger TypeScript app-level DX than generic actor platforms
- clearer stateful actor model than raw WebSocket stacks
- better hosted runtime story than a library alone
- open source trust and adoption
- narrow realtime focus compared with general compute platforms

## Next Step

The next PMF move is not to build every infrastructure feature.

It is to:

- pick one wedge use case
- make the end-to-end actor deploy loop work
- close the obvious reliability and security gaps
- get real teams to build with it
- watch where the product naturally pulls

PMF will come from a narrow and credible actor-infrastructure win, not broad
surface area.
