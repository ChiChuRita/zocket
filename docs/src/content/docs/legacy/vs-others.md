---
title: Why Zocket?
description: "[Legacy v1] Comparison with Socket.io and raw WebSockets"
---

> **This documents the old v1 API.** See [Getting Started](/getting-started/) for the current version.

## vs. Socket.io

| Feature | Socket.io | Zocket |
| :--- | :--- | :--- |
| **Type Safety** | Partial (via manual interfaces) | **End-to-End Inferred** |
| **Validation** | Manual | **Built-in (Zod/Valibot)** |
| **Developer Experience** | Event strings (`"chat:msg"`) | **Fluent API** (`client.chat.msg`) |

In Socket.io, you define interfaces on both client and server manually. Zocket infers types directly from your router.

## vs. Raw WebSockets

With Raw WebSockets you have to build protocol parsing, routing, room management, and type safety yourself. Zocket provides structured routing, rooms, and validation out of the box.

## Summary

Use **Zocket** if you use TypeScript and want tRPC-like DX for WebSockets.
Use **Socket.io** if you need HTTP long-polling fallbacks or use JavaScript without types.
