# @zocket/react

Type-safe React hooks for Zocket WebSockets. Build real-time applications with end-to-end type safety.

## Installation

```bash
bun add @zocket/react @zocket/client @zocket/core zod
```

## Quick Start

### 1. Initialize Zocket React (Factory Pattern)

Create a file to define your typed hooks. This pattern ensures you don't have to pass generics everywhere.

```tsx
// src/utils/zocket.ts
import { createZocketReact } from "@zocket/react";
import type { AppRouter } from "./server"; // Import your router type

export const zocket = createZocketReact<AppRouter>();
```

### 2. Wrap your app with the Provider

```tsx
// src/App.tsx
import { createZocketClient } from "@zocket/client";
import { zocket } from "./utils/zocket";

const client = createZocketClient("ws://localhost:3000");

function App() {
  return (
    <zocket.ZocketProvider client={client}>
      <YourApp />
    </zocket.ZocketProvider>
  );
}
```

### 3. Use type-safe hooks

```tsx
import { zocket } from "./utils/zocket";

function ChatComponent() {
  const client = zocket.useClient();
  const { status } = zocket.useConnectionState();
  const [messages, setMessages] = useState([]);

  // Type-safe event listening
  zocket.useEvent(client.on.chat.newMessage, (data) => {
    setMessages((prev) => [...prev, data]);
  });

  // Type-safe RPC query
  const { data: profile, loading } = zocket.useCall(
    (c) => c.users.getProfile({ id: '1' }),
    []
  );

  // Type-safe RPC mutation
  const sendMessage = zocket.useMutation(
    (c, text: string) => c.chat.send({ text })
  );

  return (
    <div>
      <div>Status: {status}</div>
      <button onClick={() => sendMessage.mutate("Hello!")}>Send</button>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.text}</div>
      ))}
    </div>
  );
}
```

## API Reference

### `createZocketReact<TRouter>()`

Generates a set of typed hooks and components for a specific router.

Returns:
- `ZocketProvider`: Provider component for the client.
- `useClient()`: Access the typed client instance.
- `useConnectionState()`: Monitor connection status.
- `useEvent(subscribe, handler, deps?)`: Subscribe to events.
- `useCall(caller, deps, options?)`: Handle request-response lifecycle.
- `useMutation(mutationFn)`: Handle imperative actions.

### Standalone Hooks

You can also import standalone hooks if you prefer manual configuration:

- `useEvent(subscribe, handler, deps)`
- `useConnectionState(client)`
- `useCall(client, caller, deps, options)`
- `useMutation(client, mutationFn)`

## Features

- **End-to-End Type Safety** - Catch errors at compile time.
- **Factory Pattern** - Clean API without repetitive generics.
- **RPC Support** - Built-in hooks for request-response patterns (`useCall`, `useMutation`).
- **Real-time Subscriptions** - Declarative event handling with `useEvent`.
- **Zero Config** - Sensible defaults for production real-time apps.

## License

MIT
