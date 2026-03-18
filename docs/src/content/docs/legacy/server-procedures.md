---
title: Procedures
description: "[Legacy v1] Defining inputs, handlers, and validation"
---

> **This documents the old v1 API.** See [Actors](/core/actors/) for the current version.

Procedures (incoming messages) are the client → server entry points in your Zocket router.

## Anatomy of a Procedure

1. **Input Validation** (Optional)
2. **Middleware** (Optional)
3. **Handler** (Required)

```typescript
const sendMessage = zo.message
  .use(authMiddleware)
  .input(z.object({ text: z.string() }))
  .handle(({ ctx, input }) => {
    console.log(ctx.clientId, input.text);
  });
```

## Input Validation

```typescript
.input(
  z.object({
    title: z.string().min(1),
    tags: z.array(z.string()).max(5).optional()
  })
)
```

If the input is invalid, the handler will not run.

## Async Handlers

Handlers can be asynchronous and return values (RPC style):

```typescript
.handle(async ({ ctx, input }) => {
  const post = await db.post.create({ data: { title: input.title } });
  return post;
})
```
