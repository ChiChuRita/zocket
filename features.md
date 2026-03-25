# Zocket — Planned Features

This document describes features that are designed but not yet implemented. Each section explains the DX, why it matters, and how it would work under the hood.

## Plain Object State

State definitions switch from Zod schemas to plain object literals. The initial value is the default AND the type source — no schema library needed for state.

### Current (Zod)

```ts
const counter = actor({
  state: z.object({
    count: z.number().default(0),
    players: z.array(z.string()).default([]),
    phase: z.enum(["lobby", "playing"]).default("lobby"),
  }),
  methods: { ... },
});
```

### Proposed (plain object)

```ts
const counter = actor({
  state: {
    count: 0,
    players: [] as string[],
    phase: "lobby" as "lobby" | "playing",
  },
  methods: { ... },
});
```

TypeScript infers the type from the object. The object itself is used as the default state when a new actor instance is created. No `.default()` boilerplate, no Zod dependency for state.

This is how Zustand, Jotai, and XState handle state — give it a value, the type is inferred.

### Method inputs stay validated

Method inputs still use Zod (or any Standard Schema). Inputs come from clients over WebSocket — untrusted data needs runtime validation. State is server-internal and doesn't cross a trust boundary.

```ts
methods: {
  set: {
    input: z.object({ value: z.number().min(0) }), // validated
    handler: ({ state, input }) => {
      state.count = input.value; // state is just a typed object
    },
  },
},
```

---

## Targeted Events and Connection Tracking

Currently, `emit("event", payload)` broadcasts to all event subscribers on an actor instance. There's no way to send an event to a specific client, list connected clients, or route based on connection identity.

### Why this matters

- **Games**: show each player only their own hand
- **Permissions**: send admin-only events to admin connections
- **DMs**: private messages within a shared actor
- **Errors**: send validation errors only to the client that caused them

### DX

```ts
const GameRoom = actor({
  state: {
    players: {} as Record<string, { hand: string[]; score: number }>,
  },

  methods: {
    dealCards: {
      handler: ({ state, emit, connections }) => {
        // Broadcast to everyone
        emit("roundStarted", { round: 1 });

        // Send each player their private hand
        for (const id of connections.list()) {
          const player = state.players[id];
          if (player) {
            emit.to(id, "yourHand", { cards: player.hand });
          }
        }
      },
    },

    kick: {
      input: z.object({ playerId: z.string() }),
      handler: ({ state, input, emit }) => {
        delete state.players[input.playerId];
        // Notify only the kicked player
        emit.to(input.playerId, "kicked", { reason: "removed by host" });
      },
    },
  },

  events: {
    roundStarted: {} as { round: number },
    yourHand: {} as { cards: string[] },
    kicked: {} as { reason: string },
  },
});
```

### API

**`emit(event, payload)`** — broadcast to all event subscribers (unchanged).

**`emit.to(connectionId, event, payload)`** — send to one specific connection. The event only reaches that client.

**`connections.list()`** — returns `string[]` of currently connected client IDs. Read-only.

State stays broadcast — all subscribers see the same patches. Private data goes through targeted events. This is how multiplayer game servers work: shared state for public info, targeted events for private info.

### Event definitions

Events switch from Zod to plain type literals, matching the state change:

```ts
// Current (Zod)
events: {
  newMessage: z.object({ text: z.string(), from: z.string() }),
},

// Proposed (plain type)
events: {
  newMessage: {} as { text: string; from: string },
},
```

Events are server-created — they don't need runtime validation. The type literal gives you compile-time checking on `emit()` calls without Zod.

---

## Timers

Actors can schedule delayed self-calls. A timer fires after a given duration and invokes a method on the same actor instance, through the same sequential queue.

### Why

Almost every realtime app needs "do X after Y seconds":

- Game: "start the round in 10 seconds"
- AI agent: "timeout if no response in 30 seconds"
- Chat: "mark user as away after 5 minutes of inactivity"
- E-commerce: "hold this reservation for 15 minutes, then release"

Without built-in timers, developers end up wiring `setTimeout` outside the actor, breaking the single-writer guarantee, or building their own scheduling layer.

### DX

```ts
const GameRoom = actor({
  state: z.object({
    phase: z.enum(["lobby", "countdown", "playing"]).default("lobby"),
  }),

  methods: {
    startCountdown: {
      handler: ({ state, timer }) => {
        state.phase = "countdown";
        timer.after(10_000).beginRound();
      },
    },
    beginRound: {
      handler: ({ state }) => {
        state.phase = "playing";
      },
    },
    set: {
      input: z.object({ value: z.number() }),
      handler: ({ state, input }) => {
        state.phase = input.value > 0 ? "playing" : "lobby";
      },
    },
  },
});
```

`timer` is available in every handler context — method handlers, `onConnect`, `onDisconnect`, `onActivate`.

### API

The timer API uses method chaining — the same pattern as the client SDK. `timer.after(ms)` and `timer.every(ms)` return a typed proxy of the actor's own methods:

```ts
interface TimerApi<TMethods extends MethodDefs> {
  /** Returns a typed proxy — call any method to schedule it after the delay. */
  after(ms: number): TimerMethodProxy<TMethods>;

  /** Returns a typed proxy — call any method to schedule it on a recurring interval. */
  every(ms: number): TimerMethodProxy<TMethods>;

  /** Cancel a previously scheduled timer or interval. */
  cancel(id: string): void;
}

// Each method on the proxy returns a cancellable timer ID
type TimerMethodProxy<TMethods> = {
  [K in keyof TMethods]: TMethods[K] extends { input: infer I extends StandardSchemaV1 }
    ? (input: InferSchema<I>) => string
    : () => string;
};
```

This gives you full type safety through method chaining:

```ts
timer.after(5000).beginRound();           // autocompletes method names
timer.after(5000).beginRuond();           // compile error — typo caught
timer.after(5000).set({ value: 10 });     // input type-checked against schema
timer.after(5000).set();                  // compile error — missing required input
timer.after(5000).beginRound({ x: 1 });   // compile error — beginRound takes no input

const id = timer.every(1000).tick();       // returns timer ID
timer.cancel(id);                          // cancel it
```

Consistent with how the client SDK works: `client.counter("main").increment()`.

### How it works

- `timer.after(ms)` returns a Proxy. Accessing any property on it (e.g., `.beginRound`) returns a function. Calling that function schedules a `setTimeout` that enqueues the method call into the actor's sequential queue.
- `timer.every(ms)` works the same but uses `setInterval`.
- The method runs through the same queue as client-initiated calls, preserving single-writer.
- Timer-invoked methods use a sentinel `connectionId` (`"__timer__"`) and do not trigger `onConnect` / `onDisconnect` hooks.
- All timers are cleared when an actor is deactivated or destroyed.

### Limitations

- Without persistence, timers are lost on runtime restart. An actor that restarts will need to re-schedule its timers in `onActivate`.
- No sub-millisecond precision. Timers inherit JavaScript's `setTimeout` semantics.

---

## Cron (Declarative Intervals)

Actors can declare recurring schedules as part of their definition. Cron schedules are auto-started on activation and auto-stopped on deactivation.

### Why

Many actors need periodic work: cleanup idle players, sync to external APIs, compute leaderboards, heartbeat checks. Rather than manually wiring `timer.every()` inside `onActivate`, cron makes the intent declarative and visible in the actor definition.

### DX

```ts
const Presence = actor({
  state: z.object({
    users: z.record(z.number()).default({}),
  }),

  methods: {
    heartbeat: {
      handler: ({ state, connectionId }) => {
        state.users[connectionId] = Date.now();
      },
    },
    cleanup: {
      handler: ({ state }) => {
        const now = Date.now();
        for (const [id, lastSeen] of Object.entries(state.users)) {
          if (now - lastSeen > 30_000) delete state.users[id];
        }
      },
    },
  },

  cron: {
    cleanup: { every: 30_000 },
  },
});
```

### How it works

Cron is syntactic sugar over the timer system. When an actor instance activates:

1. `onActivate` runs (if defined)
2. For each entry in `cron`, the runtime calls `timer.every(interval).method()` internally

When the actor deactivates, all timers (including cron-created ones) are cleared.

### Configuration

```ts
cron?: {
  [K in keyof TMethods]?: { every: number };
};
```

Fully type-safe — method names are constrained to the actor's own methods at compile time. Typos are caught by TypeScript. Cron only works with methods that require no input (methods with required input will fail schema validation at runtime).

---

## Actor-to-Actor Calls

Actors can call methods on other actor instances directly from within a handler.

### Why

Without actor-to-actor communication, every actor is an island. Real applications need composition:

- A lobby actor creates a match actor and tells players to join
- An AI orchestrator delegates to specialized tool actors
- A chat room actor notifies a presence actor
- A payment actor triggers a notification actor

### DX

```ts
const Lobby = actor({
  state: z.object({
    players: z.array(z.string()).default([]),
  }),

  methods: {
    startMatch: {
      handler: async ({ state, actors }) => {
        const matchId = crypto.randomUUID();
        await actors.match(matchId).initialize({
          players: state.players,
        });
        state.players = [];
        return { matchId };
      },
    },
  },
});
```

`actors` is a proxy with the same ergonomic shape as the client SDK: `actors.actorType(id).method(input)`.

### API

```ts
// Available in handler context as `actors`
type ActorsProxy = Record<
  string,
  (id: string) => Record<string, (input?: any) => Promise<any>>
>;
```

### How it works

- In standalone mode: the call goes directly through the `ActorManager` in the same process. `manager.getOrCreate(type, id)` → `instance.invokeInternal(method, input)`.
- In distributed mode (single runtime): same — actor-to-actor calls are local since all actors live on the same runtime.
- In distributed mode (multi-runtime, future): the call would publish to JetStream and await a reply via NATS request/reply. The calling actor's queue is not blocked during the await — other actors can process concurrently.

Actor-to-actor calls use a special `invokeInternal` path that:
- Skips connection tracking (no `onConnect` / `onDisconnect`)
- Uses a sentinel `connectionId` (`"__actor__"`)
- Returns the method's return value directly

### Typing

Actor-to-actor calls are **not type-safe**. The `actors` proxy uses `Record<string, ...>` — no autocomplete on actor names, method names, or inputs.

This is a fundamental limitation, not a shortcut. The circular dependency is:

1. `actor()` defines the handler function and its types
2. The handler needs `actors` typed with all actors in the app
3. But the app is assembled later by `createApp({ actors: { ... } })`
4. Which depends on the actors defined in step 1

There is no way to type step 2 without knowing step 3, which depends on step 1. TypeScript cannot resolve this cycle.

At runtime, the proxy is fully functional — `actors.match("abc").start({ players: [] })` works correctly. You just don't get compile-time checking on the call. Errors surface at runtime as "Unknown actor" or "Unknown method" exceptions.

This is the same trade-off other actor frameworks make. Erlang/Elixir GenServer calls are untyped. Temporal activity invocations are untyped. The alternative would be a fundamentally different API pattern (e.g., passing actor references explicitly), which would sacrifice the ergonomic proxy syntax.

### Fire-and-forget

Actor-to-actor calls are request/response by default — the caller awaits the result. For many agent patterns, you want fire-and-forget: push work onto another actor's queue and move on immediately.

```ts
handler: async ({ state, actors }) => {
  // Request/response — waits for result
  const result = await actors.researcher("topic").search({ query: "..." });

  // Fire-and-forget — returns immediately, work happens in background
  actors.researcher("topic").search.send({ query: "..." });
}
```

`.send()` enqueues the method call on the target actor and returns immediately. No result, no waiting. The target actor processes it through its normal sequential queue.

This is important for two reasons:

1. **Agent delegation without blocking.** A manager agent tells 5 worker agents to start working and doesn't block on any of them. Workers call back with results when done.
2. **Avoids deadlocks.** If actor A and actor B need to communicate bidirectionally, fire-and-forget breaks the cycle. A sends to B, B sends to A — neither blocks waiting for the other.

At the protocol level, fire-and-forget is a new message type `rpc:fire` that doesn't expect an `rpc:result` back. Internally it's the same as a regular actor-to-actor call, but the caller's promise resolves immediately after the message is enqueued.

### Deadlock warning

If actor A **awaits** a call to actor B and actor B **awaits** a call back to actor A, this deadlocks — A's queue is waiting for B, and B's call to A can't enter A's queue. This is a known property of single-writer actor models (same as Erlang GenServers). Use `.send()` (fire-and-forget) for circular communication.

---

## Type Safety Summary

| Feature | Type-safe? | What's checked |
|---------|-----------|----------------|
| `timer.after(ms).method()` | Yes | Method name autocompletes, input type-checked |
| `timer.every(ms).method()` | Yes | Same |
| `timer.cancel(id)` | Yes | ID is string |
| `cron: { method: { every } }` | Yes | Method names constrained to `keyof TMethods` |
| `actors.type(id).method()` | No | Untyped — circular dependency prevents it |
| `actors.type(id).method.send()` | No | Same limitation as above |

Timers and cron use the same method chaining pattern as the client SDK. Actor-to-actor calls use the same pattern ergonomically but without compile-time types.

---

## Streaming Methods

By default, state patches are computed and broadcast when a handler finishes. For long-running methods (LLM calls, file processing, multi-step workflows), you want patches to stream to clients as state changes — not after the handler returns.

### `stream: true`

Mark a method as streaming. The runtime automatically broadcasts state patches at a regular interval (default ~50ms) while the handler executes:

```ts
const Conversation = actor({
  state: z.object({
    output: z.string().default(""),
    status: z.enum(["idle", "thinking", "done"]).default("idle"),
  }),

  methods: {
    // Regular method — patches sent on completion
    reset: {
      handler: ({ state }) => {
        state.output = "";
        state.status = "idle";
      },
    },

    // Streaming method — patches sent automatically as state changes
    generate: {
      stream: true,
      handler: async ({ state }) => {
        state.status = "thinking";
        // client sees "thinking" within ~50ms

        for await (const chunk of llmStream) {
          state.output += chunk;
          // patches batch and send automatically every tick
        }

        state.status = "done";
        // final patches sent on completion
      },
    },
  },
});
```

The handler looks exactly like a regular handler. No `flush()` calls, no generators, no new syntax. The only difference is `stream: true` on the method definition.

### How it works

When a streaming method executes, the runtime runs a tick loop (every ~50ms):

1. Finalize the current Immer draft, compute JSON patches
2. Broadcast patches to all state subscribers
3. Create a fresh Immer draft for continued mutation

When the handler finishes, a final flush sends any remaining patches. The tick loop stops.

Regular methods (without `stream: true`) are unchanged — one draft, patches computed once at the end.

### Configuration

```ts
// Boolean — use default interval (~50ms)
stream: true,

// Custom interval in milliseconds
stream: { interval: 16 },  // ~60fps for game state
stream: { interval: 100 }, // lower frequency for less chatty updates
```

---

## How They Work Together

These features compose naturally:

```ts
const AgentRun = actor({
  state: z.object({
    messages: z.array(z.any()).default([]),
    status: z.enum(["running", "waiting", "done"]).default("running"),
  }),

  methods: {
    start: {
      input: z.object({ prompt: z.string() }),
      stream: true,
      handler: async ({ state, input, timer, actors }) => {
        state.messages.push({ role: "user", content: input.prompt });
        state.messages.push({ role: "assistant", content: "" });

        const result = streamText({
          model: openai("gpt-4o"),
          messages: state.messages.slice(0, -1),
        });

        for await (const chunk of result.textStream) {
          state.messages.at(-1).content += chunk;
          // patches stream to client automatically
        }

        if (result.toolCalls?.length) {
          for (const tool of result.toolCalls) {
            await actors.tool(tool.name).execute(tool.args);
          }
        }

        timer.after(30_000).timeout();
        state.status = "done";
      },
    },

    timeout: {
      handler: ({ state }) => {
        if (state.status === "running") {
          state.status = "done";
        }
      },
    },
  },
});
```

`stream: true` for token streaming. Timer for timeout safety. Actor-to-actor for tool delegation. All running through the same sequential queue with single-writer guarantees.

---

## AI SDK Integration

Zocket integrates with the Vercel AI SDK and TanStack AI SDK. Developers keep their familiar `useChat()` hooks on the client — the backend is a Zocket actor instead of an API route.

### Why

Developers already use `useChat()`. Fighting that adoption is pointless. Instead, Zocket becomes the backend that makes `useChat()` more powerful — stateful conversations, multiplayer-aware, durable, with typed actors behind it.

### DX — Server

```ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { aiHandler } from "@zocket/ai";

const Conversation = actor({
  state: z.object({
    messages: z.array(z.any()).default([]),
  }),

  methods: {
    chat: aiHandler({
      model: openai("gpt-4o"),
      // messages managed automatically from actor state
      // response streams back in AI SDK wire format
      // tool calls can dispatch to other actors
    }),
  },
});
```

`aiHandler()` wraps the AI SDK's `streamText()` into a Zocket actor method. It reads messages from actor state, calls the LLM, streams the response in the AI SDK's wire format, and updates `state.messages` when complete. Tool calls can dispatch to other actors via the `actors` proxy.

### DX — Client

```tsx
import { useChat } from "ai/react"; // or @tanstack/react-ai
import { useZocketAI } from "@zocket/ai/react";

function Chat() {
  const { messages, input, handleSubmit, isLoading } = useChat({
    fetch: useZocketAI("conversation", chatId),
  });

  return (
    <form onSubmit={handleSubmit}>
      {messages.map(m => <Message key={m.id} {...m} />)}
      <input value={input} onChange={e => setInput(e.target.value)} />
    </form>
  );
}
```

`useZocketAI(actorType, actorId)` returns a `fetch`-compatible adapter. It translates `useChat()`'s HTTP requests into Zocket WebSocket messages. The AI SDK hooks work unchanged — they don't know or care that the backend is an actor.

### What developers get for free

By putting `useChat()` on top of a Zocket actor instead of an API route:

- **Multiplayer conversations** — open the same chat in two tabs, both see tokens stream in real-time. `useChat()` over HTTP is per-client; over Zocket, it's shared state.
- **Server-authoritative history** — the actor owns the messages array. No client-side state to reconcile.
- **Actor lifecycle** — timeouts via `timer.after()`, tool delegation via `actors`, cron for periodic work.
- **Typed state** — the conversation state is Zod-validated, types flow end-to-end.
- **Extracting connections** — the actor survives reconnects. HTTP-based `useChat()` loses context on disconnect.

### Packages

**`@zocket/ai`** (server):
- `aiHandler(config)` — creates an actor method that wraps `streamText`/`generateText`
- Manages `state.messages` lifecycle (append user message, stream assistant response, collect tool results)
- Tool calls dispatch to other actors via `actors` context
- Handles `AbortSignal` for cancellation ("stop generating")

**`@zocket/ai/react`** (client):
- `useZocketAI(actorType, actorId)` — returns a `fetch` adapter for `useChat({ fetch: ... })`
- Translates between AI SDK's HTTP streaming protocol and Zocket's WebSocket messages
- Works with both Vercel AI SDK and TanStack AI SDK

### What this requires from Zocket core

| Requirement | Description |
|---|---|
| **Streaming methods** | `stream: true` on method definitions — `aiHandler` uses this internally so state patches (tokens) stream to clients automatically. |
| **Streaming RPC** | New protocol message `rpc:stream` for sending partial return values before `rpc:result`. The `useZocketAI` adapter converts these into a `ReadableStream` body that `useChat()` consumes. |
| **AbortSignal in handler context** | Cancellation support. Client sends abort → handler's signal fires → LLM call cancelled. |

---

## Implementation Priority

1. **Plain object state + event types** — remove Zod from state/events, simplify DX. Touches core types and server runtime.
2. **Targeted events + connections** — `emit.to()` and `connections.list()`. Touches server runtime.
3. **Timers** — lowest effort, highest immediate value
4. **Cron** — trivial extension of timers
5. **Actor-to-actor** — enables composition, slightly more complex (Proxy wiring, invokeInternal)
6. **Streaming methods** (`stream: true`) — unlocks real-time LLM token streaming and any long-running handler
7. **Streaming RPC** (`rpc:stream`) — unlocks the AI SDK adapter
8. **`@zocket/ai` integration** — the AI SDK adapter layer, built on top of streaming

Features 1-5 only touch `@zocket/core` (types) and `@zocket/server` (runtime). Client and gateway are unaffected.

Feature 6 touches only `@zocket/server` (runtime tick loop for streaming methods).

Feature 7 touches the protocol (`@zocket/core`), server, and client (new `rpc:stream` message type).

Feature 8 is a new package (`@zocket/ai`) that depends on everything below it.
