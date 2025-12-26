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
- **Reconnect Helpers** - Manual reconnect and connection lifecycle hooks
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

### Client Setup

```typescript
import { createZocketClient } from "@zocket/client";
import type { AppRouter } from "./server";

const client = createZocketClient<AppRouter>("ws://localhost:3000", {
  // Browser clients can’t send real HTTP headers; Zocket maps these to URL query params.
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

This repo’s tests are a good source of working examples:

- `packages/core/test/simple.test.ts` (ping/pong + server push)
- `packages/core/test/rooms.test.ts` (rooms)
- `packages/core/test/fluent-api.test.ts` (middleware + routing patterns)
- `packages/core/test/valibot.test.ts` (Valibot integration)

## Related Packages

- [@zocket/client](https://www.npmjs.com/package/@zocket/client) - Browser WebSocket client for Zocket
- [@zocket/react](https://www.npmjs.com/package/@zocket/react) - React hooks for Zocket

## License

MIT © [Rahul Singh](https://github.com/ChiChuRita)

## Repository

[https://github.com/ChiChuRita/zocket](https://github.com/ChiChuRita/zocket)
