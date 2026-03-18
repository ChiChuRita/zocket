---
title: Broadcasting
description: "[Legacy v1] Targeting messages to specific clients"
---

> **This documents the old v1 API.** See [Actors](/core/actors/) for the current version.

When you construct a message, you must specify who receives it.

### Broadcast
Sends the message to all connected clients.

```typescript
send.chat.message({ ... }).broadcast();
```

### Direct Message
Sends the message to specific client IDs.

```typescript
send.chat.message({ ... }).to([targetClientId]);
```

### Rooms
Sends the message to all clients in a specific room.

```typescript
send.chat.message({ ... }).toRoom(["room-123"]);
```
