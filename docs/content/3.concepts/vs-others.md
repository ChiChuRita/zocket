---
title: Why Zocket?
description: Comparison with Socket.io and raw WebSockets
icon: lucide:scale
---

Understanding how Zocket differs from other solutions helps in choosing the right tool for your project.

## vs. Socket.io

Socket.io is a battle-tested library that has been the industry standard for years. However, it was built in an era before TypeScript dominance.

| Feature | Socket.io | Zocket |
| :--- | :--- | :--- |
| **Type Safety** | Partial (via manual interfaces) | **End-to-End Inferred** |
| **Validation** | Manual | **Built-in (Zod/Valibot)** |
| **Developer Experience** | Event strings (`"chat:msg"`) | **Fluent API** (`client.chat.msg`) |
| **Payload Size** | Larger (custom protocol overhead) | Minimal (JSON) |
| **Reconnection** | Built-in | Manual / Configurable |

### The Problem with Socket.io Types
In Socket.io, you often have to define interfaces on both client and server manually.

```typescript
// Shared file
interface ServerToClientEvents {
  message: (data: { text: string }) => void;
}

// Server
io.emit("message", { text: "Hello" });

// Client
socket.on("message", (data) => {
  // data is typed ONLY if you manually import and pass the generic
});
```

If you change the server event name or payload, the client code **won't complain** until you manually update the shared interface.

### The Zocket Way
Zocket infers types directly from your router. You **cannot** send a message that doesn't match the schema, and you **cannot** listen to an event that doesn't exist.

```typescript
// Server: Change 'text' to 'content'
.outgoing({ message: z.object({ content: z.string() }) })

// Client: Immediately errors!
client.on.message((data) => {
  console.log(data.text); // Error: Property 'text' does not exist.
});
```

## vs. Raw WebSockets

Using the native `WebSocket` API is lightweight but requires you to reinvent the wheel for almost everything.

### What you have to build manually with Raw WebSockets:
1.  **Protocol**: You need to decide how to parse strings vs JSON.
2.  **Routing**: You need a `switch` statement or map to route messages to functions.
3.  **Room Management**: You need to implement your own logic to group clients.
4.  **Type Safety**: You are on your own parsing `any`.

### How Zocket Improves on Raw WebSockets
Zocket provides a thin but powerful abstraction over native WebSockets (using `ws` or `Bun.serve`).

- **Structured Routing**: Organizing logic into nested routers (e.g., `chat.room.join`) is built-in.
- **Rooms**: Zocket includes a highly efficient room system out of the box.
- **Validation**: Incoming data is automatically validated against your schemas before it ever reaches your handler.

## Summary

Use **Zocket** if:
- You use TypeScript.
- You want the developer experience of tRPC but for WebSockets.
- You want your client to break immediately when you change your backend.

Use **Socket.io** if:
- You need fallbacks to HTTP long-polling (legacy browser support).
- You are using JavaScript without types.
