---
title: Client
description: Vanilla TypeScript/JavaScript client usage
icon: lucide:monitor
---

The Zocket client (`@zocket/client`) is a typed WebSocket client that generates methods from your router type.

It requires a `WebSocket` implementation available on `globalThis` (browsers and Bun have this by default; in Node.js you may need to polyfill).

## Installation

```bash
bun add @zocket/client
```

## Node.js note

If you’re using Node.js and don’t have `globalThis.WebSocket`, you can polyfill it (example using `ws`):

```ts
import WebSocket from "ws";
(globalThis as any).WebSocket = WebSocket as any;
```

## Basic Usage

```typescript
import { createZocketClient } from "@zocket/client";
import type { AppRouter } from "./server";

const client = createZocketClient<AppRouter>("ws://localhost:3000");

// Listen
client.on.chat.message((msg) => console.log(msg));

// Send
client.chat.post({ text: "Hi" });
```
