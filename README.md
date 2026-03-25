# Zocket

> Typed actors for realtime apps

Define stateful actors with typed methods, events, and state — then call them from any client with full end-to-end type safety over WebSockets.

**[Documentation](https://docs.zocket.ws)** | **[Getting Started](https://docs.zocket.ws/getting-started/)**

## Features

- **Actor Model** — stateful units with sequential execution, no race conditions
- **End-to-End Type Safety** — define once with Zod, types flow to client automatically
- **State Sync** — Immer-managed state with JSON patch broadcasting
- **RPC over WebSocket** — request/response with timeout, pending tracking, auto-reconnect
- **Events** — typed pub/sub with lazy subscriptions
- **Middleware** — chainable auth, context enrichment with full type inference
- **React Hooks** — `useActor`, `useActorState`, `useEvent`, `useConnectionStatus`
- **Lifecycle Hooks** — `onActivate` / `onDeactivate` for actor lifecycle, `onConnect` / `onDisconnect` for presence tracking

## Packages

| Package | Description |
|---------|-------------|
| `@zocket/core` | Actor definitions, types, protocol |
| `@zocket/server` | Runtime, actor manager, platform adapters |
| `@zocket/client` | WebSocket client with RPC, reconnection, state sync |
| `@zocket/react` | React hooks and context provider |
| `@zocket/runtime` | NATS-connected distributed actor runtime |
| `@zocket/gateway` | WebSocket gateway that bridges clients to NATS |
| `@zocket/cli` | CLI for bundling and deploying actors |

## Quick Start

```bash
bun add @zocket/core @zocket/server @zocket/client zod
```

### Define an Actor

```ts
import { z } from "zod";
import { actor, createApp } from "@zocket/core";

const ChatRoom = actor({
  state: z.object({
    messages: z.array(z.object({
      from: z.string(),
      text: z.string(),
    })).default([]),
  }),

  methods: {
    sendMessage: {
      input: z.object({ from: z.string(), text: z.string() }),
      handler: ({ state, input }) => {
        state.messages.push(input);
      },
    },
  },
});

export const app = createApp({ actors: { chat: ChatRoom } });
```

### Serve It

```ts
import { serve } from "@zocket/server/bun";
import { app } from "./app";

serve(app, { port: 3000 });
```

### Connect a Client

```ts
import { createClient } from "@zocket/client";
import type { app } from "./app";

const client = createClient<typeof app>({ url: "ws://localhost:3000" });

const room = client.chat("general");
await room.sendMessage({ from: "Alice", text: "Hello!" });

room.state.subscribe((state) => {
  console.log(state.messages);
});
```

### Use with React

```tsx
import { createClient } from "@zocket/client";
import { createZocketReact } from "@zocket/react";
import type { app } from "./app";

const client = createClient<typeof app>({ url: "ws://localhost:3000" });
const { ZocketProvider, useActor, useActorState } = createZocketReact<typeof app>();

function Chat() {
  const room = useActor("chat", "general");
  const messages = useActorState(room, (s) => s.messages);

  return (
    <ul>
      {messages?.map((m, i) => (
        <li key={i}>{m.from}: {m.text}</li>
      ))}
    </ul>
  );
}

function App() {
  return (
    <ZocketProvider client={client}>
      <Chat />
    </ZocketProvider>
  );
}
```

## Development

```bash
bun install
bun test packages/server/test/
```

## License

MIT
