---
title: React
description: "[Legacy v1] Type-safe hooks for React applications"
---

> **This documents the old v1 API.** See [React Setup](/react/setup/) for the current version.

## Setup

```tsx
// src/utils/zocket.ts
import { createZocketReact } from "@zocket/react";
import type { AppRouter } from "path-to-your-server-router-type";

export const zocket = createZocketReact<AppRouter>();
```

## Provider

```tsx
import { createZocketClient } from "@zocket/client";
import { zocket } from "./utils/zocket";

const client = createZocketClient("ws://localhost:3000");

export default function App() {
  return (
    <zocket.ZocketProvider client={client}>
      <Dashboard />
    </zocket.ZocketProvider>
  );
}
```

## Basic Usage

```tsx
function MyComponent() {
  const client = zocket.useClient();
  const { status } = zocket.useConnectionState();
  return <div>Connection: {status}</div>;
}
```
