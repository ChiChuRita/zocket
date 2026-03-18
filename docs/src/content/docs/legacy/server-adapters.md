---
title: Adapters
description: "[Legacy v1] Run Zocket on different runtimes"
---

> **This documents the old v1 API.** See [Bun Adapter](/server/bun-adapter/) for the current version.

Zocket's server is adapter-based.

## Bun (recommended)

```ts
import { zocket, createBunServer } from "@zocket/core";

const zo = zocket.create({ /* ... */ });
const appRouter = zo.router().outgoing({ /* ... */ }).incoming(() => ({}));

const handlers = createBunServer(appRouter, zo);

Bun.serve({
  fetch: handlers.fetch,
  websocket: handlers.websocket,
  port: 3000,
});
```

## Custom adapter

If your runtime provides a WebSocket connection with `send`, `close`, and optional pub/sub, you can wire it via `createServer`:

```ts
import { createServer, type ServerAdapter } from "@zocket/core";

const adapter: ServerAdapter = {
  start({ port, hostname, onUpgrade, onOpen, onMessage, onClose }) {
    return {
      port: port ?? 3000,
      stop() { /* ... */ },
      publish(topic, message) { /* optional */ },
    };
  },
};

const server = createServer(appRouter, zo, adapter, { port: 3000 });
```
