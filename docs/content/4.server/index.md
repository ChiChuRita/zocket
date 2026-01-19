---
title: Server
description: Server-side setup and message handling
icon: lucide:server
---

To create a Zocket server, you first need a Zocket instance and a Router.

## Server Initialization

```typescript
import { zocket, createBunServer } from "@zocket/core";
import { z } from "zod";

const zo = zocket.create({
  headers: z.object({ auth: z.string() }),
  onConnect: (headers) => ({ userId: headers.auth }),
  onDisconnect: (ctx, clientId) => {
    console.log(`User ${ctx.userId} disconnected`);
  }
});

const appRouter = zo.router().outgoing({}).incoming(() => ({}));

// Create Bun handler
const handlers = createBunServer(appRouter, zo);

Bun.serve({
  fetch: handlers.fetch,
  websocket: handlers.websocket,
});
```

## Sending Messages

In Zocket, sending messages is type-safe. The `send` object mirrors your `outgoing` router definition.

### Within Handlers
The `send` object is passed as an argument to the `.incoming()` callback.

```typescript
.incoming(({ send }) => ({
  echo: zo.message.input(z.string()).handle(({ input }) => {
    send.echo({ text: input }).broadcast();
  })
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
