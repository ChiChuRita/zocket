---
title: Context
description: "[Legacy v1] State management per connection"
---

> **This documents the old v1 API.** See [Middleware](/core/middleware/) for the current version.

Context (`ctx`) persists for the lifetime of a WebSocket connection.

## Creating Context

```typescript
const zo = zocket.create({
  headers: z.object({
    authorization: z.string().optional(),
  }),
  onConnect: async (headers, clientId) => {
    const user = headers.authorization
      ? await verifyToken(headers.authorization)
      : null;
    return { user, connectedAt: new Date() };
  },
});
```

## Built-in Context

| Property | Type | Description |
| :--- | :--- | :--- |
| `clientId` | `string` | Unique identifier for the connection |
| `rooms` | `RoomOperations` | Helper to join/leave rooms |

### Rooms API

- `join(roomId)` — Add the connection to a room
- `leave(roomId)` — Remove from a room
- `has(roomId)` — Check membership
- `current` — `ReadonlySet<string>` of joined rooms
