# Infrastructure

Zocket should be multi-tenant at the platform layer while staying opinionated at the product layer.

The infrastructure exists to support message-driven stateful apps. It should not redefine the product as generic compute.

## V1 Shape

V1 should be simple and credible.

The intended shape is:

- shared gateway fleet
- shared NATS / JetStream
- dedicated actor runtimes per tenant
- control plane for deployments, releases, and metadata

This is enough to get useful isolation without taking on full sandboxing or microVM complexity.

## Core Model

The core platform model is:

- developers deploy versioned actor bundles
- end users connect over WebSockets
- actors are addressed by `(tenantId, appId, actorType, actorId)`
- each actor processes messages sequentially
- the platform handles routing, lifecycle, and release management

The important rule is that actors are still message-driven stateful handlers. They are not generic compute containers.

## Main Planes

The platform naturally splits into four planes.

### Gateways

Gateways terminate client connections and handle:

- auth and session lifecycle
- subscriptions
- ingress validation
- publishing actor calls into JetStream
- forwarding outbound events and state updates

Gateways should stay stateless or near-stateless. They are shared infrastructure, not actor hosts.

### Actor runtimes

Actor runtimes are where tenant code actually runs.

They handle:

- loading bundles
- activating actors lazily
- sequential method execution
- hot state
- snapshots and restore
- event and patch emission

This is the most important execution boundary in the system.

### Placement

Placement decides which runtime owns a given actor.

V1 can stay simple. Over time this likely becomes:

- stable ownership
- rebalance support
- better runtime capacity awareness

The product does not need a complicated placement system before the core realtime loop is working well.

### Control plane

The control plane manages:

- builds and deployment artifacts
- releases
- tenant metadata
- runtime health
- logs and metrics wiring

This is what turns a runtime into a usable platform.

## Transport

WebSockets are the main client transport.

Clients should be able to:

- connect once
- call actor methods
- subscribe to events
- subscribe to state over time
- reconnect cleanly

Internally, NATS and JetStream handle routing and durable delivery.

The important boundary is:

- NATS is transport and buffering
- it is not the source of truth for actor ownership or state

## Durability And State

The baseline durability model should be:

- hot state in memory
- snapshots for cold restore
- release metadata in the control plane
- durable message delivery through JetStream

This gives the platform room to scale without forcing every actor to stay hot forever.

## V1 Versus End State

V1 does not need the full end-state architecture.

V1 should prove:

- the actor model
- the gateway to runtime path
- deploy and release flow
- tenant-aware routing
- enough durability for real apps

The end state can later grow into:

- more advanced placement
- stronger tenant isolation
- broader runtime orchestration
- richer reconnect and resume behavior
- more flexible scaling across runtime hosts

That evolution is fine as long as the product stays recognizable.

## Product Boundary

The most important infrastructure decision is what not to become.

Zocket should avoid becoming:

- generic background compute
- freeform runtime infrastructure
- a catch-all system for jobs, workflows, and arbitrary execution

The cleaner story is:

- message-driven actors
- realtime application state
- typed client interaction
- deployable platform support

## Takeaway

The infrastructure should make the product feel simpler, not broader.

The right mental model is still:

- define actors
- deploy a version
- connect clients
- let the platform handle routing, lifecycle, and state fanout
