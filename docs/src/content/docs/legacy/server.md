---
title: Server
description: "[Legacy v1] Server-side setup and message handling"
---

> **This documents the old v1 API.** See [Bun Adapter](/server/bun-adapter/) for the current version.

To create a Zocket server, you create:

1. A Zocket instance (`zocket.create(...)`)
2. A router (`zo.router().outgoing(...).incoming(...)`)
3. A server adapter (today: Bun via `createBunServer`)

## Server Initialization

```typescript
import { zocket, createBunServer } from "@zocket/core";
import { z } from "zod";

const zo = zocket.create({
  headers: z.object({ authorization: z.string().optional() }),
  onConnect: (headers, clientId) => ({ userId: headers.authorization ?? null }),
  onDisconnect: (ctx, clientId) => {
    console.log(`Client disconnected: ${clientId}`);
  }
});

const appRouter = zo
  .router()
  .outgoing({
    system: {
      announcement: z.object({ text: z.string() }),
    },
  })
  .incoming(({ send }) => ({
    system: {
      announce: zo.message
        .input(z.object({ text: z.string() }))
        .handle(({ input }) => {
          send.system.announcement({ text: input.text }).broadcast();
        }),
    },
  }));

const handlers = createBunServer(appRouter, zo);

Bun.serve({
  fetch: handlers.fetch,
  websocket: handlers.websocket,
  port: 3000,
});
```

## Sending Messages

The `send` object mirrors your `outgoing` router definition. You can also use `handlers.send` for server push outside handlers.
