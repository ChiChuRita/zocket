---
title: Authentication (v1)
description: "[Legacy v1] Secure your WebSocket connections"
---

> **This documents the old v1 API.** See [Authentication](/guides/authentication/) for the current version.

Authentication happens during the initial connection handshake. Headers are sent as URL query parameters.

### Server Side

```typescript
const zo = zocket.create({
  headers: z.object({ token: z.string() }),
  onConnect: async (headers) => {
    const user = await verifyToken(headers.token);
    if (!user) return { user: null };
    return { user };
  },
});
```

### Client Side

```typescript
const client = createZocketClient<AppRouter>("ws://localhost:3000", {
  headers: { token: "user-session-token" },
});
```
