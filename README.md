# Zocket

> Type-safe WebSocket library with end-to-end type safety, similar to tRPC

A modern, type-safe WebSocket library that brings the developer experience of tRPC to real-time applications. Build WebSocket applications with full TypeScript inference, schema validation, and runtime safety.

## Features

- **End-to-end Type Safety** - Full TypeScript inference from server to client
- **Schema Validation** - Works with Zod, Valibot, and any Standard Schema compatible library
- **Real-time Rooms** - Built-in support for WebSocket rooms/channels
- **Middleware Support** - Composable middleware for authentication, logging, etc.
- **Reconnect Helpers** - Manual reconnect and connection lifecycle hooks
- **React Integration** - First-class React hooks support
- **Runtime Agnostic** - Works with Bun, Node.js, Deno, and browsers

## Packages

This monorepo contains the following packages:

- **[@zocket/core](./packages/core)** - Router builder + server helpers/adapters
- **[@zocket/client](./packages/client)** - Browser WebSocket client with typed `send`/`on`
- **[@zocket/react](./packages/react)** - React bindings (`ZocketProvider`, `useZocket`, `useEvent`)

## Quick Start

### Installation

```bash
bun add @zocket/core @zocket/client @zocket/react zod
```

### Server

```typescript
import { z } from "zod";
import { zocket, createBunServer } from "@zocket/core";

const zo = zocket.create({
  headers: z.object({
    authorization: z.string(),
  }),
  onConnect: (headers, clientId) => {
    return { userId: headers.authorization };
  },
});

export const appRouter = zo
  .router()
  .outgoing({
    chat: {
      onMessage: z.object({ text: z.string(), from: z.string() }),
    },
  })
  .incoming(({ send }) => ({
    chat: {
      message: zo.message
        .input(z.object({ text: z.string() }))
        .handle(({ ctx, input }) => {
          send.chat
            .onMessage({
              text: input.text,
              from: ctx.userId,
            })
            .broadcast();
        }),
    },
  }));

export type AppRouter = typeof appRouter;

const handlers = createBunServer(appRouter, zo);

Bun.serve({
  fetch: handlers.fetch,
  websocket: handlers.websocket,
  port: 3000,
});
```

### Server-initiated messages (push)

You can send outgoing messages from anywhere in your server code (cron jobs, DB listeners, admin tools, etc.) using `handlers.send`:

```typescript
handlers.send.chat
  .onMessage({ text: "Hello from the server!", from: "system" })
  .broadcast();
```

### Client (React)

```tsx
import { useState } from "react";
import {
  ZocketProvider,
  useZocket,
  useConnectionState,
  createZocketClient,
} from "@zocket/react";
import type { AppRouter } from "./server";

const zocketClient = createZocketClient<AppRouter>("ws://localhost:3000", {
  // Browser clients can’t send real HTTP headers; Zocket maps these to URL query params.
  headers: { authorization: "user-token" },
});

function App() {
  return (
    <ZocketProvider<AppRouter> client={zocketClient}>
      <ChatComponent />
    </ZocketProvider>
  );
}

function ChatComponent() {
  const { client, useEvent } = useZocket<AppRouter>();
  const { status } = useConnectionState(client);
  const [messages, setMessages] = useState<
    Array<{ text: string; from: string }>
  >([]);

  // `client.on.*` subscriptions are stable (cached), so this won’t resubscribe every render.
  useEvent(client.on.chat.onMessage, (data) => {
    setMessages((prev) => [...prev, data]);
  });

  return (
    <div>
      <div>Connection: {status}</div>
      {messages.map((msg, i) => (
        <div key={i}>
          {msg.from}: {msg.text}
        </div>
      ))}
      <button onClick={() => client.chat.message({ text: "Hello!" })}>
        Send
      </button>
    </div>
  );
}
```

## Development

### Install Dependencies

```bash
bun install
```

### Build All Packages

```bash
cd packages/core && bun run build
cd packages/react && bun run build
```

### Run Tests

```bash
cd packages/core && bun test
```

### Development Mode

```bash
cd packages/core && bun run dev
```

## Monorepo Structure

```
zocket/
├── packages/
│   ├── core/           # Router builder + server helpers
│   ├── client/         # Browser client
│   └── react/          # React bindings
└── docs/               # Documentation site
```

## Documentation

For comprehensive documentation, see the docs site at [`./docs`](./docs) or check individual package READMEs:

- [@zocket/core README](./packages/core/README.md)
- [@zocket/client README](./packages/client/README.md)
- [@zocket/react README](./packages/react/README.md)

## Examples

This repo’s tests are a good source of copy-pasteable examples:

- `packages/core/test/simple.test.ts` (ping/pong + server push)
- `packages/core/test/rooms.test.ts` (rooms)
- `packages/core/test/fluent-api.test.ts` (middleware + routing patterns)
- `packages/core/test/valibot.test.ts` (Valibot integration)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Rahul Singh](https://github.com/ChiChuRita)

## Author

**Rahul Singh**

- Email: ra.singh069@gmail.com
- GitHub: [@ChiChuRita](https://github.com/ChiChuRita)
