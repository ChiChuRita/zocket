---
title: Client
description: "[Legacy v1] Vanilla TypeScript/JavaScript client usage"
---

> **This documents the old v1 API.** See [Creating a Client](/client/creating-a-client/) for the current version.

The Zocket client (`@zocket/client`) is a typed WebSocket client that generates methods from your router type.

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
