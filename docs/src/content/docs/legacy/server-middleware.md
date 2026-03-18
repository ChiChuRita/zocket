---
title: Middleware (v1)
description: "[Legacy v1] Per-message context augmentation and gating"
---

> **This documents the old v1 API.** See [Middleware](/core/middleware/) for the current version.

Zocket middleware runs before a handler and can add derived values to `ctx` or block execution by throwing.

## Signature

```ts
const withExtras = zo.message.use(({ ctx, payload }) => {
  return { /* merged into ctx */ };
});
```

## Authentication + context narrowing

```ts
const requireUser = zo.message.use(({ ctx }) => {
  if (!ctx.user) throw new Error("UNAUTHORIZED");
  return { user: ctx.user };
});
```

## Composing middleware

```ts
const requireAdmin = ({ ctx }) => {
  if (ctx.userRole !== "admin") throw new Error("FORBIDDEN");
  return { isAdmin: true as const };
};

const adminMessage = requireUser.use(requireAdmin);
```

## Notes

As of `@zocket/core@0.1.0`, thrown errors are not serialized back to the client. If middleware throws, the client call may reject due to RPC timeout.
