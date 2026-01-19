---
title: Core Concepts
description: Understand the building blocks of Zocket
icon: lucide:brain
---

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

A **Message** definition in the incoming router specifies:
1.  **Input Schema**: Validates the data sent by the client.
2.  **Handler**: The function that executes when the message is received.
3.  **Middleware**: Optional logic to run before the handler (e.g., authentication).

```typescript
zo.message
  .input(z.object({ roomId: z.string() }))
  .handle(({ ctx, input }) => {
    ctx.rooms.join(input.roomId);
  });
```

## Context

The **Context** (`ctx`) is an object that is available in every message handler. It is created when a client connects and persists for the duration of the connection.

You define how the context is created in `zocket.create()`:

```typescript
const zo = zocket.create({
  headers: z.object({ token: z.string() }),
  onConnect: (headers, clientId) => {
    const user = verifyToken(headers.token);
    return {
      user,
      db: getDbConnection(),
    };
  }
});
```

In your handlers:

```typescript
.handle(({ ctx }) => {
  console.log(ctx.user.id); // Type-safe access to user
});
```

### Built-in Context
Zocket adds some built-in properties to your context:
- `ctx.clientId`: The unique ID of the connected client.
- `ctx.rooms`: Methods to join (`.join()`) and leave (`.leave()`) rooms.

## Middleware

Middleware allows you to wrap message handlers with common logic. You can modify the context or throw errors to block execution.

```typescript
const protectedProcedure = zo.message.use(({ ctx }) => {
  if (!ctx.user) {
    throw new Error("Unauthorized");
  }
  return { ...ctx, user: ctx.user }; // Refine context type
    });

// Use it in your router
.incoming(() => ({
  secret: protectedProcedure
    .input(z.string())
    .handle(({ ctx }) => {
      // ctx.user is guaranteed to be present here
    })
}))
```
