---
title: React
description: Type-safe hooks for React applications
icon: lucide:atom
---

The `@zocket/react` package provides a factory to generate type-safe hooks and a provider for your application. It follows a pattern similar to tRPC, making your server's router definitions available throughout your frontend.

## Installation

```bash
bun add @zocket/react
```

## Initial Setup

The recommended way to use Zocket with React is through the **Factory Pattern**. This allows you to define your typed hooks in a single file and use them without repeating generic types like `<AppRouter>` everywhere.

### 1. Create your Zocket hooks

Create a file to initialize your React integration:

```tsx
// src/utils/zocket.ts
import { createZocketReact } from "@zocket/react";
import type { AppRouter } from "../../../server/index"; // Import your server's router type

export const zocket = createZocketReact<AppRouter>();
```

### 2. Configure the Provider

Wrap your application root with the generated `ZocketProvider`.

```tsx
// src/App.tsx
import { createZocketClient } from "@zocket/client";
import { zocket } from "./utils/zocket";

// Create the client instance (usually outside the component)
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

Once set up, you can use the typed hooks anywhere in your component tree:

```tsx
import { zocket } from "./utils/zocket";

function MyComponent() {
  const client = zocket.useClient();
  const { status } = zocket.useConnectionState();

  return (
    <div>
      Connection status: {status}
      <button onClick={() => client.chat.send({ text: "Hello!" })}>
        Send Message
      </button>
    </div>
  );
}
```
