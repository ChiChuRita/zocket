# TODOS

Operational backlog generated from `/plan-ceo-review` on 2026-04-20.

Mode: HOLD SCOPE. Approach: C (compete with Rivet on actor infrastructure). Both
the CEO review and the outside voice (Codex) flagged this as contradicting the
existing strategy notes; founder elected to proceed willfully. Rewriting strategy
docs to match is item P1-3 below.

---

## P1 — Blocks design partner #1

### 1. Scope actor keys by tenant

**What:** Change actor manager keys from `${actorName}:${actorId}` to
`${workspaceId}:${projectId}:${actorName}:${actorId}` in
`packages/server/src/runtime.ts:396` (and call sites).

**Why:** Codex finding. Today the actor key has no tenant scope. If routing ever
mis-delivers a message (gateway bug, NATS subject misconfig, deployment race), one
tenant can read or mutate another tenant's actor state. Defense in depth: the
runtime's own data structures should make cross-tenant access impossible by
construction, not just by deployment discipline.

**Pros:** Closes a class of bug entirely. Cheap.

**Cons:** Touches the hottest path; need to keep API stable. Test coverage gap
makes this slightly riskier than ideal.

**Context:** `md/v1/auth.md` says "dedicated runtimes per tenant" is the boundary,
but the in-process actor manager doesn't enforce that. Today's "single tenant per
runtime" rule is implicit. Make it explicit in the data model.

**Effort:** S (human ~half-day / CC ~1 hour).
**Priority:** P1.
**Depends on:** none. Pre-requisite for any external launch.

---

### 2. Structured logging + request ID propagation

**What:** Replace all `console.error`/`console.log` in `packages/gateway`,
`packages/runtime`, `packages/server`, `packages/nats-transport` with a structured
logger (pino). Generate a request ID at the gateway, propagate through NATS
envelope metadata into the runtime, include it in every log line.

**Why:** Without structured logs you cannot reconstruct a 3-week-old incident from
production. You also cannot ship logs to Datadog/Honeycomb/Loki with grep. This
is table stakes for "infra-grade."

**Pros:** Unblocks all observability work (metrics, traces, dashboards, runbooks).

**Cons:** Touches every package. Requires envelope protocol additions (request ID
field).

**Context:** Currently 9 files use `console.error("[gateway] Failed to publish
inbound:", err)`. None of these include tenant ID, actor ID, or method name. When
a customer says "my actor is weird," there's no way to find their requests.

**Effort:** M (human ~3 days / CC ~2 days).
**Priority:** P1.
**Depends on:** none. Blocks #5, #6, items P2-9, P2-10.

---

### 3. Rewrite strategy docs to match Approach C

**What:** Rewrite `md/pmf.md`, `md/competition.md`, `md/context.md` to reflect the
chosen positioning ("actor infrastructure for TS teams") instead of the current
"narrow typed-realtime app DX" framing.

**Why:** The current docs explicitly warn against the path the founder just chose.
If unaddressed, the docs will fight every future decision: every PR will surface
the contradiction, every new contributor will be confused, every external
publication will misrepresent the company. Codex called this out in the outside
voice review.

**Pros:** Removes a permanent source of internal friction. Forces explicit
articulation of why Approach C is the right call.

**Cons:** Rewriting good prose is hard. Risk of producing weaker prose than the
originals (which are unusually sharp).

**Context:** Useful framing: keep the discipline of the original ("avoid roadmap
drift," "narrow and opinionated") but apply it to the new positioning. The
opponent shifts from Liveblocks/PartyKit to Rivet/Cloudflare DO. The wedge shifts
from "best DX for one app shape" to "best TS-native actor infra." The honesty
about single-node v1 must be in the docs from day one, not a footnote.

**Effort:** S (human ~1 day / CC ~3 hours).
**Priority:** P1.
**Depends on:** none. Should happen before any outbound marketing under new positioning.

---

### 4. Rollback command + deploy smoke test in CLI

**What:** Add `zocket rollback` to revert to the previous deployment. Add a
post-deploy smoke test in `cli deploy`: bundle → upload → health-check in a
sandbox runtime → atomic switch → auto-rollback on smoke failure.

**Why:** Without rollback, the hosted platform is one bad deploy away from a bad
incident. Without smoke tests, bad deploys reach production.

**Pros:** Required for any paying customer. Reduces incident duration from "hours
of debugging" to "one command + investigate."

**Cons:** Requires control plane support for "previous deployment" tracking.

**Context:** Currently `cli deploy` likely does bundle + upload and prays. Confirm
or fix during implementation.

**Effort:** M (human ~3 days / CC ~1 day).
**Priority:** P1.
**Depends on:** Control plane has deployment history (may already exist).

---

### 5. Replace silent failures in nats-bridge

**What:** Fix `packages/gateway/src/nats-bridge.ts:61, 92, 97`. Each currently
catches exceptions, logs to `console.error`, and continues silently. Replace each
with: named exception class, retry with backoff for transient errors, dead letter
queue for terminal errors, structured log with full context, metric increment.

**Why:** Today, when NATS hiccups, a user calls `room.sendMessage(...)`, the
message vanishes, the client sees nothing, no metric fires. This is the opposite
of "infra-grade." It's also the kind of bug that destroys trust the first time
it happens to a real user.

**Pros:** Fixes the single biggest reliability gap.

**Cons:** Requires DLQ infrastructure (can use NATS JetStream DLQ).

**Context:** Specifically: `publishInbound` (line 61), outbound forward in
`startOutboundConsumer` (line 92), and consumer setup itself (line 97). All three
swallow.

**Effort:** S (human ~1 day / CC ~3 hours).
**Priority:** P1.
**Depends on:** #2 (structured logging).

---

### 6. Fix error info leaks

**What:** `packages/gateway/src/index.ts:67` returns `error?.message ?? "Unauthorized"`
to unauthenticated callers. `packages/server/src/handler.ts:38` returns
`err?.message` to client over RPC. Both leak internal error context.

Replace with: log the full error server-side (with request ID via #2), return a
generic message + request ID to the caller so support can correlate.

**Why:** Security. Information disclosure of stack traces and internal error
strings is a fingerprintable footgun for attackers and a noisy signal for users.

**Pros:** Tightens the threat surface. Still debuggable via request ID lookup.

**Cons:** None.

**Effort:** S (human ~half-day / CC ~30 min).
**Priority:** P1.
**Depends on:** #2 (structured logging) ideally — but can be done first with a
basic `crypto.randomUUID()` in the meantime.

---

### 7. Unit test coverage bundle

**What:** Add unit tests for: `@zocket/core` (actor, middleware, types),
`@zocket/gateway` (session, nats-bridge, control-plane), `@zocket/runtime`
(consumer, virtual-connection), `@zocket/nats-transport` (streams, codec),
`@zocket/react` (all hooks), `@zocket/cli` (bundle, deploy).

Goal: every public API has happy-path + at-least-one-failure test.

**Why:** 4 test files for 3,517 LOC of framework code is not infra-grade. You
cannot regress-test bugs that don't have tests. You cannot refactor safely.

**Pros:** Makes future changes safer. Documents intended behavior. Required
prerequisite before bringing on additional engineers.

**Cons:** L effort. Will surface bugs as you write tests (which is the point but
slows ship velocity briefly).

**Context:** Pair with property-based tests where possible (fast-check) — the
actor model has nice invariants (sequential execution, state shape preserved,
events ordered).

**Effort:** L (human ~1-2 weeks / CC ~1 sprint).
**Priority:** P1.
**Depends on:** none.

---

### 8. ARCHITECTURE.md at repo root

**What:** A single document explaining: what NATS is for, what JetStream is for,
why the runtime is single-node in v1, what migration looks like in v2, why
Approach C, what's deliberately out of scope. Audience: a new engineer joining in
12 months.

**Why:** Without this, decisions made today get re-argued every time someone new
opens the codebase. Strategy docs in `md/` cover the why; architecture lives in
its own document.

**Pros:** Permanent leverage. Saves hours per future contributor.

**Cons:** Has to be maintained as architecture changes.

**Context:** Cross-link to `md/v1/auth.md`, `md/features.md`, and updated
`md/pmf.md` from #3.

**Effort:** S (human ~1 day / CC ~2 hours).
**Priority:** P1.
**Depends on:** #3 (strategy docs rewritten first so ARCHITECTURE.md doesn't
contradict them).

---

## P2 — Required before launch / next sprint

### 9. Async fan-out for broadcast

**What:** When an actor `emit`s to N subscribers, currently the broadcast is a
sync loop in the actor's queue. Move to async fan-out so the actor can process
the next message while broadcast completes.

**Why:** At 1k+ subscribers per actor, the sync loop blocks the queue measurably.
Game lobbies, large chat rooms, popular AI sessions all hit this.

**Pros:** Removes a real scaling cliff.

**Cons:** Subtle ordering implications — document carefully.

**Effort:** S (human ~1 day / CC ~3 hours).
**Priority:** P2.

---

### 10. Typed error classes

**What:** Define `ActorMethodError`, `ActorStateInvariantError`,
`ActorTimeoutError`, `ActorRateLimitError`, `ActorAuthError`. Throw the right one
in the right place. Catch by class in observability.

**Why:** Observability needs to distinguish "user code threw" from "platform timed
out" from "tenant exceeded quota." Today everything is generic `Error`.

**Pros:** Enables error-class-based metrics, alerts, runbooks.

**Cons:** Touches many files.

**Effort:** S (human ~1 day / CC ~4 hours).
**Priority:** P2.
**Depends on:** #2 (structured logging) for full benefit.

---

## Deferred (tracked but not committed)

These were explicitly deferred during the review. They are not in scope but
should not be forgotten.

- **DOS protection** (rate limit, payload cap). Founder deferred. Every infra
  buyer will ask. Expect calls.
- **Multi-node runtime + actor migration.** Single-node v1 is a willful choice.
  Multi-node is the path to real "infra" credibility.
- **Snapshot+seq reconnect.** Deferred entirely. Clients re-subscribe on
  reconnect. Real apps will hit edge cases.
- **Durable execution claim.** Pulled from v1 marketing. JetStream is a
  reliability boost, not a durability guarantee, in v1 messaging.
- **OpenTelemetry traces.** Wait until structured logging (#2) is in.
- **Prometheus metrics + Grafana dashboards.** Wait until structured logging is in.
- **Custom domains.** v1 is `{tenant}.zocket.io` only.
- **Firecracker / microVM tenant isolation.** Dedicated runtime per tenant is
  the v1 boundary.
- **Distributed test harness.** Built before features per founder decision (item
  not yet started; track scope as part of #7 expansion).
- **Runbook for common incidents.** Becomes important once external users exist.
- **Connection pool caching for Convex control plane.** Performance, P3.
