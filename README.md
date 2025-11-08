# Zocket

> Type-safe WebSocket library with end-to-end type safety, similar to tRPC

A modern, type-safe WebSocket library that brings the developer experience of tRPC to real-time applications. Build WebSocket applications with full TypeScript inference, schema validation, and runtime safety.

## Features

- **End-to-end Type Safety** - Full TypeScript inference from server to client
- **Schema Validation** - Works with Zod, Valibot, and any Standard Schema compatible library
- **Real-time Rooms** - Built-in support for WebSocket rooms/channels
- **Middleware Support** - Composable middleware for authentication, logging, etc.
- **Auto-Reconnection** - Built-in reconnection with exponential backoff
- **React Integration** - First-class React hooks support
- **Runtime Agnostic** - Works with Bun, Node.js, Deno, and browsers

## Packages

This monorepo contains the following packages:

- **[@zocket/core](./packages/core)** - Core WebSocket library with type-safe client and server
- **[@zocket/react](./packages/react)** - React hooks for Zocket WebSockets
- **[examples](./packages/examples)** - Example applications and demos

## Quick Start

### Installation

```bash
bun add @zocket/core @zocket/react zod
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

const router = {
  chat: {
    message: zo.message.incoming({
      payload: z.object({ text: z.string() }),
    }),
    onMessage: zo.message.outgoing({
      payload: z.object({ text: z.string(), from: z.string() }),
    }),
  },
};

const appRouter = zo.router(router, {
  chat: {
    message: ({ payload, ctx }) => {
      ctx.send.chat
        .onMessage({
          text: payload.text,
          from: ctx.userId,
        })
        .broadcast();
    },
  },
});

const handlers = createBunServer(appRouter, zo);

Bun.serve({
  fetch: handlers.fetch,
  websocket: handlers.websocket,
  port: 3000,
});
```

### Client (React)

```tsx
import { ZocketProvider, useZocket } from "@zocket/react";
import type { AppRouter } from "./server";

function App() {
  return (
    <ZocketProvider<typeof router> url="ws://localhost:3000">
      <ChatComponent />
    </ZocketProvider>
  );
}

function ChatComponent() {
  const { client, useEvent } = useZocket<typeof router>();
  const [messages, setMessages] = useState([]);

  useEvent(client.on.chat.onMessage, (data) => {
    setMessages((prev) => [...prev, data]);
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>
          {msg.from}: {msg.text}
        </div>
      ))}
      <button onClick={() => client.send.chat.message({ text: "Hello!" })}>
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
│   ├── core/           # Core WebSocket library
│   ├── react/          # React hooks
│   └── examples/       # Example applications
└── www/
    └── docs/           # Documentation site
```

## Documentation

For comprehensive documentation, visit the [documentation site](./www/docs) or check individual package READMEs:

- [@zocket/core README](./packages/core/README.md)
- [@zocket/react README](./packages/react/README.md)

## Examples

See the [examples directory](./packages/examples) for complete working examples:

- Simple ping-pong
- Chat rooms with real-time messaging
- Private messaging between clients
- Broadcast notifications
- Multiplayer game example

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Rahul Singh](https://github.com/ChiChuRita)

## Author

**Rahul Singh**

- Email: ra.singh069@gmail.com
- GitHub: [@ChiChuRita](https://github.com/ChiChuRita)
