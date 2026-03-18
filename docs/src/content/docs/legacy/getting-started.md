---
title: Getting Started
description: "[Legacy v1] Get up and running with Zocket v1 in minutes"
---

> **This documents the old v1 API.** See [Getting Started](/getting-started/) for the current version.

This guide will walk you through creating a simple real-time application with Zocket.

## Installation

Install the core package, the client package, and Zod (or your preferred schema validation library).

```bash
bun add @zocket/core @zocket/client zod
```

If you are using React, you can also add the React hooks package:

```bash
bun add @zocket/react
```

## Quick Start

### 1. Define your Router

Create a router on your server. This defines the messages your server can send (`outgoing`) and the messages it can receive (`incoming`).

```typescript
// server.ts
import { z } from "zod";
import { zocket, createBunServer } from "@zocket/core";

const zo = zocket.create({
  headers: z.object({
    authorization: z.string().default("guest"),
  }),
  onConnect: (headers) => {
    return { userId: headers.authorization };
  },
});

export const appRouter = zo
  .router()
  .outgoing({
    chat: {
      message: z.object({ text: z.string(), from: z.string() }),
    },
  })
  .incoming(({ send }) => ({
    chat: {
      post: zo.message
        .input(z.object({ text: z.string() }))
        .handle(({ ctx, input }) => {
          send.chat
            .message({
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

### 2. Create a Client

On the client side, you can now connect to your server with full type safety.

```typescript
// client.ts
import { createZocketClient } from "@zocket/client";
import type { AppRouter } from "./server";

const client = createZocketClient<AppRouter>("ws://localhost:3000", {
  headers: { authorization: "Alice" },
});

client.on.chat.message((data) => {
  console.log(`${data.from}: ${data.text}`);
});

client.chat.post({ text: "Hello world!" });
```
