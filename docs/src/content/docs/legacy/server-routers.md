---
title: Routers
description: "[Legacy v1] Organizing your application logic"
---

> **This documents the old v1 API.** See [Apps](/core/apps/) for the current version.

Routers define the structure of your API and hold your procedures.

## Creating a Router

```typescript
const appRouter = zo.router()
  .outgoing({ /* Server -> Client messages */ })
  .incoming(({ send }) => ({ /* Client -> Server messages */ }));
```

## Modularizing Routers

Extract sections into helpers and compose with object spread:

```typescript
export const chatOutgoing = {
  chat: {
    message: z.object({ text: z.string(), from: z.string() }),
  },
} as const;

export function chatIncoming({ send }) {
  return {
    chat: {
      post: zo.message
        .input(z.object({ text: z.string() }))
        .handle(({ ctx, input }) => {
          send.chat.message({ text: input.text, from: ctx.clientId }).broadcast();
        }),
    },
  } as const;
}

export const appRouter = zo
  .router()
  .outgoing({ ...chatOutgoing })
  .incoming(({ send }) => ({ ...chatIncoming({ send }) }));
```
