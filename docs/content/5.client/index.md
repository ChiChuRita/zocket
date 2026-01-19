---
title: Client
description: Vanilla TypeScript/JavaScript client usage
icon: lucide:monitor
---

The Zocket client (`@zocket/client`) works in any environment that supports `WebSocket`, including Browsers, Node.js, Deno, and Bun.

## Installation

```bash
bun add @zocket/client
```

## Basic Usage

```typescript
import { createZocketClient } from "@zocket/client";
import type { AppRouter } from "./server";

const client = createZocketClient<AppRouter>("ws://localhost:3000");

// Listen
client.on.chat.message((msg) => console.log(msg));

// Send
await client.chat.send({ text: "Hi" });
```
