---
title: Usage Patterns
description: "[Legacy v1] RPC, subscriptions, and type safety"
---

> **This documents the old v1 API.** See [Actor Handles](/client/actor-handles/) for the current version.

## Subscriptions (Listening)

```typescript
const unsubscribe = client.on.system.notification((data) => {
  toast(data.message);
});
unsubscribe();
```

## RPC (Request / Response)

```typescript
const user = await client.users.get({ id: "123" });
```

### Timeouts

Fixed 10-second RPC timeout. If the server never responds, the promise rejects.

## Fire-and-forget

If the handler returns `void`, the client method is typed as `void`:

```ts
client.analytics.track({ event: "click" });
```
