---
title: Server
description: Server-side setup and message handling
icon: lucide:server
---

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

// Create Bun handler
const handlers = createBunServer(appRouter, zo);

Bun.serve({
  fetch: handlers.fetch,
  websocket: handlers.websocket,
  port: 3000,
});
```

## Sending Messages

In Zocket, sending messages is type-safe. The `send` object mirrors your `outgoing` router definition.

### Within Handlers
The `send` object is passed as an argument to the `.incoming()` callback.

```typescript
.incoming(({ send }) => ({
  system: {
    announce: zo.message.input(z.object({ text: z.string() })).handle(({ input }) => {
      send.system.announcement({ text: input.text }).broadcast();
    }),
  },
}))
```

### Outside Handlers (Server Push)
You can also send messages from outside the router (e.g., from a cron job or API route) using the `handlers.send` object exposed by the server adapter.

```typescript
const handlers = createBunServer(appRouter, zo);

// Send a message every minute
setInterval(() => {
  handlers.send.system.announcement({ text: "Tick" }).broadcast();
}, 60000);
```
