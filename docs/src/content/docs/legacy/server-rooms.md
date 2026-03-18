---
title: Rooms
description: "[Legacy v1] Managing WebSocket rooms and memberships"
---

> **This documents the old v1 API.** See [Actors](/core/actors/) for the current version.

Rooms group clients for targeted broadcasting.

### Joining a Room

```typescript
.incoming(({ send }) => ({
  joinRoom: zo.message
    .input(z.object({ roomId: z.string() }))
    .handle(({ ctx, input }) => {
      ctx.rooms.join(input.roomId);
    })
}))
```

### Leaving a Room

```typescript
ctx.rooms.leave("room-123");
```

### Checking Membership

```typescript
if (ctx.rooms.has("admin-room")) { /* ... */ }
```

### Sending to a room

```ts
send.chat.message({ text: "hello" }).toRoom(["room-123"]);
```
