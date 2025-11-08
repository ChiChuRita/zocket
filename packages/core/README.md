# @zocket/core

> Type-safe WebSocket library with end-to-end type safety, similar to tRPC

[![npm version](https://img.shields.io/npm/v/@zocket/core.svg)](https://www.npmjs.com/package/@zocket/core)
[![license](https://img.shields.io/npm/l/@zocket/core.svg)](https://github.com/ChiChuRita/zocket/blob/main/packages/core/LICENSE)

Zocket is a type-safe WebSocket library that provides end-to-end type safety between client and server, inspired by tRPC. Build real-time applications with confidence using TypeScript and your favorite schema validation library (Zod, Valibot, or any Standard Schema compatible library).

## Features

- **End-to-end Type Safety** - Full TypeScript inference from server to client
- **Schema Validation** - Works with Zod, Valibot, and any Standard Schema compatible library
- **Real-time Rooms** - Built-in support for WebSocket rooms/channels
- **Middleware Support** - Composable middleware for authentication, logging, etc.
- **Auto-Reconnection** - Built-in reconnection with exponential backoff
- **Runtime Agnostic** - Works with Bun, Node.js, Deno, and browsers
- **Framework Agnostic** - Use with any framework or vanilla JS/TS

## Installation

```bash
bun add @zocket/core zod
```

Or with npm:

```bash
npm install @zocket/core zod
```

## Quick Start

### Server Setup

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

### Client Setup

```typescript
import { createZocketClient } from "@zocket/core";
import type { AppRouter } from "./server";

const client = createZocketClient<typeof router>("ws://localhost:3000", {
  headers: { authorization: "user-token" },
});

client.on.chat.onMessage((data) => {
  console.log(`${data.from}: ${data.text}`);
});

client.send.chat.message({ text: "Hello!" });
```

## Key Concepts

- **Routers** - Define your WebSocket message structure
- **Messages** - Type-safe incoming and outgoing message definitions
- **Handlers** - Server-side logic for processing incoming messages
- **Context** - Access user data, send messages, and manage rooms
- **Middleware** - Add authentication, validation, or custom logic
- **Rooms** - Group clients for targeted broadcasts

## Documentation

For comprehensive documentation, examples, and API reference, visit the [Zocket documentation](https://github.com/ChiChuRita/zocket).

## Examples

Check out the [examples directory](https://github.com/ChiChuRita/zocket/tree/main/packages/examples) for complete working examples:

- Simple ping-pong
- Chat rooms
- Private messaging
- Notifications
- Multiplayer game

## Related Packages

- [@zocket/react](https://www.npmjs.com/package/@zocket/react) - React hooks for Zocket

## License

MIT © [Rahul Singh](https://github.com/ChiChuRita)

## Repository

[https://github.com/ChiChuRita/zocket](https://github.com/ChiChuRita/zocket)
