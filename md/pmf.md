# Product Market Fit

Zocket should aim for product-market fit as the best way to build typed realtime applications with stateful actors.

The company does not need to win "actor infrastructure" in the abstract. It needs to win one sharper job: making realtime apps dramatically easier to build.

## Thesis

The strongest version of the thesis is:

- typed realtime application platform
- message-driven stateful actors
- excellent TypeScript and React experience
- open source with a low-friction path to adoption
- deployable without forcing teams to reason about transport and placement

The simplest framing is still:

Zocket is "Vercel for realtime."

## The Real User Problem

Teams building realtime products usually end up assembling too many moving parts:

- WebSockets
- RPC-style method calls
- subscriptions
- reconnection
- shared state sync
- presence
- client typing
- backend state ownership

The pain is not "I need actors."

The pain is:

- "I want backend state that stays alive and reacts in realtime."
- "I want clients to call typed methods and subscribe without protocol glue."
- "I do not want to build my own realtime runtime."

That is the problem Zocket should solve.

## Best Early Users

The strongest early users are teams that already know they need realtime behavior and are paying the cost of building it manually.

Best candidates:

- chat and community apps
- multiplayer and game backends
- collaborative tools
- AI conversation and agent-session apps

These all share the same useful shape:

- long-lived addressable state
- many clients reacting to the same changing data
- both method calls and subscriptions
- product value tied to low-latency UX

## Where PMF Probably Fails

Zocket will struggle if it is pitched too broadly.

Weak frames:

- actor platform
- distributed systems runtime
- general stateful compute
- workflows, jobs, agents, and actors in one product

Those frames push Zocket into the wrong comparisons:

- Rivet on actor-infrastructure breadth
- Trigger.dev on workflows and durable execution
- SpacetimeDB on programmable database and sync

If users need those categories first, Zocket is not the obvious winner.

## The Wedge

The wedge is not backend power alone.

It is the combination of:

- actor-first backend model
- end-to-end typing
- built-in realtime subscriptions
- state sync
- React-friendly client APIs
- open source adoption and trust
- simple deployment

Open source matters because it lowers adoption risk for infrastructure-adjacent products.

For the right teams it creates:

- easier experimentation
- more trust in the backend primitive
- stronger community distribution around examples and integrations

The product wins if the whole loop feels natural:

1. define an actor
2. call it from the client with types
3. subscribe to changes naturally
4. ship without custom realtime plumbing

## Signs Of PMF

The right signals are mostly behavioral.

Strong signals:

- users reach a first multiplayer, chat, or collaborative prototype very quickly
- teams describe Zocket as simpler than their current WebSocket stack
- subscriptions and typed client methods feel obvious without much explanation
- teams want to self-host, inspect, or extend it because it is open source
- early apps naturally map their domain objects to actors

Especially good signs:

- "We replaced a messy socket layer with this"
- "This finally makes realtime feel normal"
- "Our frontend team can use this without learning transport internals"

## What Must Be Excellent

The product probably needs to be excellent in a few areas, not merely acceptable in many.

Critical areas:

- actor definition DX
- typed client generation or inference
- subscriptions and state sync
- React integration
- local development
- deploy experience

If those feel awkward, the value proposition collapses quickly.

## What To Avoid

Avoid roadmap drift before the wedge is proven.

Be careful about:

- generic `run` primitives
- detached workflow execution
- broad infrastructure abstraction
- too many low-level escape hatches in v1
- trying to serve every actor-shaped use case at once

The right user should understand immediately why the product exists.

## Current Hypothesis

The best current hypothesis is:

Zocket can find product-market fit with TypeScript teams building chat, multiplayer, collaborative, and AI-session products who want a stateful realtime backend model without assembling sockets, subscriptions, and sync infrastructure by hand.

That lines up with the current strategic advantage:

- better app-level DX
- tighter mental model
- stronger client story
- open source trust and adoption
- less infrastructure framing

## Next Step

The next PMF move is not to build everything.

It is to:

- pick one wedge use case
- make the end-to-end DX dramatically better than the alternatives
- get a few real teams to build with it
- watch where the product feels naturally strong

PMF will come from a narrow and opinionated win, not broad surface area.
