---
title: Core Concepts
description: "[Legacy v1] Routers, messages, context, and middleware"
---

> **This documents the old v1 API.** See [Getting Started](/getting-started/) for the current version.

Zocket is built around a few key concepts that enable its type safety and developer experience.

## Routers

A **Router** is the contract between your server and client. It defines the structure of your WebSocket application. A router consists of two main parts:

### Outgoing (`.outgoing()`)
These are definitions of messages that the **Server sends to the Client**. You define the shape of the data using a schema (like Zod).

```typescript
.outgoing({
  chat: {
    message: z.object({ text: z.string(), from: z.string() }),
    typing: z.object({ userId: z.string(), isTyping: z.boolean() })
  }
})
```

### Incoming (`.incoming()`)
These are handlers for messages that the **Client sends to the Server**. You define the input schema and the handler function.

```typescript
.incoming(({ send }) => ({
  chat: {
    sendMessage: zo.message
      .input(z.object({ text: z.string() }))
      .handle(({ ctx, input }) => {
        // Handle the message
      })
  }
}))
```

## Messages

A **Message** (procedure) definition in the incoming router specifies:

1. **Input schema** (optional): validates data sent by the client
2. **Middleware** (optional): augments `ctx` and/or blocks execution
3. **Handler**: runs when the message is received

```typescript
zo.message
  .input(z.object({ roomId: z.string() }))
  .handle(({ ctx, input }) => {
    ctx.rooms.join(input.roomId);
  });
```

## Context

The **Context** (`ctx`) is an object that is available in every message handler. It is created when a client connects and persists for the duration of the connection.

```typescript
const zo = zocket.create({
  headers: z.object({ token: z.string() }),
  onConnect: (headers, clientId) => {
    const user = verifyToken(headers.token);
    return { user, db: getDbConnection() };
  }
});
```

### Built-in Context
- `ctx.clientId`: The unique ID of the connected client.
- `ctx.rooms`: Room helpers (`join`, `leave`, `has`, `current`).

## Middleware

Middleware allows you to wrap message handlers with common logic.

```typescript
const requireUser = zo.message.use(({ ctx }) => {
  if (!ctx.user) throw new Error("Unauthorized");
  return { user: ctx.user };
});
```

## JSON payloads

Zocket's transport is JSON. Prefer JSON-friendly types (strings, numbers, booleans, objects, arrays).
