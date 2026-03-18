---
title: Error Handling (v1)
description: "[Legacy v1] Managing errors on both server and client"
---

> **This documents the old v1 API.** See [Getting Started](/getting-started/) for the current version.

## Procedure (RPC) errors

Thrown errors are not serialized back to the client. The client call may reject due to RPC timeout.

### Recommended pattern

```typescript
// Server — return a typed result
.handle(({ input }) => {
  if (!isValid(input)) {
    return { ok: false as const, error: "VALIDATION_FAILED" as const };
  }
  return { ok: true as const };
})

// Client
const res = await client.doSomething(/* ... */);
if (!res.ok) console.error(res.error);
```

## Connection errors

```typescript
client.onError((err) => {
  console.error("Socket error:", err);
});
```
