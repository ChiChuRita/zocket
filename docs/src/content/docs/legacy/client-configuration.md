---
title: Client Configuration
description: "[Legacy v1] Reconnection, headers, and lifecycle hooks"
---

> **This documents the old v1 API.** See [Creating a Client](/client/creating-a-client/) for the current version.

## Initialization Options

```typescript
const client = createZocketClient<AppRouter>("ws://localhost:3000", {
  headers: {
    authorization: "Bearer token123",
  },
  onOpen: () => console.log("Connected"),
  onClose: () => console.log("Disconnected"),
  debug: process.env.NODE_ENV === "development",
});
```

## Reconnection Logic

```typescript
client.onClose(() => {
  setTimeout(() => client.reconnect(), 5000);
});
```

## Error Handling

```typescript
client.onError((error) => {
  console.error("WebSocket Error:", error);
});
```

Properties: `client.readyState`, `client.lastError`.
