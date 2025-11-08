---
title: Home
navigation: false
---

## ::hero

announcement:
title: 'Release v0.1'
icon: '🚀'
to: /getting-started/introduction
actions:

- name: Get Started
  to: /getting-started/introduction
- name: GitHub
  variant: outline
  to: https://github.com/yourusername/zocket
  leftIcon: 'lucide:github'

---

#title
End-to-end Type-safe :br WebSockets

#description
Build real-time applications with full TypeScript support. :br A tRPC-like experience for WebSocket communication.
::

## Features

::card-grid
::card{icon="lucide:shield-check"}
#title
Type-Safe
#description
End-to-end type safety from server to client with full TypeScript inference.
::

::card{icon="lucide:zap"}
#title
Developer Experience
#description
tRPC-like API with autocomplete, inline errors, and documentation directly in your IDE.
::

::card{icon="lucide:boxes"}
#title
Rooms & Broadcasting
#description
Built-in support for rooms, broadcasting, and targeted messaging out of the box.
::

::card{icon="lucide:plug"}
#title
React Integration
#description
Type-safe React hooks for seamless integration with your React applications.
::

::card{icon="lucide:refresh-cw"}
#title
Auto Reconnection
#description
Automatic reconnection with exponential backoff built into the client.
::

::card{icon="lucide:layers"}
#title
Middleware Support
#description
Composable middleware system for authentication, validation, and custom logic.
::
::

## Quick Example

::code-group

```typescript [server.ts]
import { z } from "zod";
import { zocket, createBunServer } from "@zocket/core";

const zo = zocket.create({
  headers: z.object({ user: z.string() }),
  onConnect: (headers) => ({ user: headers.user }),
});

const router = {
  chat: {
    message: zo.message.incoming({
      payload: z.object({ text: z.string() }),
    }),
    onMessage: zo.message.outgoing({
      payload: z.object({ user: z.string(), text: z.string() }),
    }),
  },
};

const appRouter = zo.router(router, {
  chat: {
    message: ({ payload, ctx }) => {
      ctx.send.chat
        .onMessage({
          user: ctx.user,
          text: payload.text,
        })
        .broadcast();
    },
  },
});

export type AppRouter = typeof router;

const handlers = createBunServer(appRouter, zo);
Bun.serve({
  fetch: handlers.fetch,
  websocket: handlers.websocket,
  port: 3000,
});
```

```typescript [client.ts]
import { createZocketClient } from "@zocket/core";
import type { AppRouter } from "./server";

const client = createZocketClient<AppRouter>("ws://localhost:3000", {
  headers: { user: "Alice" },
});

client.on.chat.onMessage((data) => {
  console.log(`${data.user}: ${data.text}`);
});

client.send.chat.message({ text: "Hello!" });
```

::

## Why Zocket?

Traditional WebSocket implementations lack type safety and require manual serialization, deserialization, and message routing. Zocket brings the same developer experience you love from tRPC to real-time WebSocket communication.

::div{class="flex gap-4 mt-8"}
::a{to="/getting-started/introduction" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"}
Get Started →
::
::a{to="/getting-started/motivation" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"}
Learn Why Zocket
::
::
