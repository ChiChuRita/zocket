---
title: Type Inference (v1)
description: "[Legacy v1] Getting the most out of TypeScript"
---

> **This documents the old v1 API.** See [Types](/core/types/) for the current version.

Always export your router type from the server and import it (as a type) in the client:

```typescript
// server.ts
export type AppRouter = typeof appRouter;

// client.ts
import type { AppRouter } from "./server";
const client = createZocketClient<AppRouter>(...);
```

This keeps your bundle size small — the runtime router code is not imported.
