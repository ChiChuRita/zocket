# @zocket/react

Type-safe React hooks for Zocket WebSockets. Build real-time applications with end-to-end type safety.

## Installation

```bash
bun add @zocket/react @zocket/core zod
```

## Quick Start

### 1. Define your router (server-side)

```typescript
import { z } from "zod";
import { zocket } from "@zocket/core";

const zo = zocket.create();

const appRouter = {
  posts: {
    create: zo.message.incoming({
      payload: z.object({ title: z.string() }),
    }),
    created: zo.message.outgoing({
      payload: z.object({
        id: z.string(),
        title: z.string(),
      }),
    }),
  },
  users: {
    joined: zo.message.outgoing({
      payload: z.object({ name: z.string() }),
    }),
  },
};

export type AppRouter = typeof appRouter;
```

### 2. Create a client and wrap your app

```tsx
import { ZocketProvider, createZocketClient } from "@zocket/react";
import type { AppRouter } from "./server";

const zocketClient = createZocketClient<AppRouter>("ws://localhost:3000", {
  headers: { user: "alice" },
  onOpen: () => console.log("Connected!"),
  onClose: () => console.log("Disconnected"),
});

function App() {
  return (
    <ZocketProvider<AppRouter> client={zocketClient}>
      <YourApp />
    </ZocketProvider>
  );
}
```

### 3. Use type-safe hooks in any component

```tsx
import { useZocket } from "@zocket/react";
import type { AppRouter } from "./server";

function ChatComponent() {
  const { client, useEvent } = useZocket<AppRouter>();
  const [messages, setMessages] = useState([]);

  useEvent(client.on.posts.created, (data) => {
    setMessages((prev) => [...prev, data]);
  });

  useEvent(client.on.users.joined, (data) => {
    console.log(`${data.name} joined!`);
  });

  const sendMessage = () => {
    client.send.posts.create({ title: "Hello!" });
  };

  return (
    <div>
      <button onClick={sendMessage}>Send</button>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.title}</div>
      ))}
    </div>
  );
}
```

## API Reference

### `<ZocketProvider>`

Provider component that shares a `ZocketClient` instance with React children.

**Props:**

- `client: ZocketClient<TRouter>` - A pre-configured client instance (create one with `createZocketClient`)
- `children: ReactNode` - React children
- `disconnectOnUnmount?: boolean` - Close the client when the provider unmounts (default: `true`)

> 💡 This mirrors React Query’s `QueryClientProvider`: create the client once (module scope, context provider, or `useState`) and reuse it.

### `createZocketClient<TRouter>(url, options?)`

Factory that builds a type-safe client. It’s re-exported from `@zocket/client` for convenience. Options include reconnection delays, headers, debug logging, and lifecycle callbacks.

### `useZocket<TRouter>()`

Hook to access the Zocket client and event listener.

**Returns:**

- `client: ZocketClient<TRouter>` - The Zocket client instance for sending messages
- `useEvent: (subscribe, handler, deps?) => void` - Hook for type-safe event listening

### `useEvent(subscribeFn, handler, deps?)`

Type-safe event listener hook (returned from `useZocket`).

**Parameters:**

- `subscribeFn: (callback) => UnsubscribeFn` - Subscription function from `client.on` (e.g., `client.on.posts.created`)
- `handler: (payload) => void` - Event handler (payload is fully typed and automatically inferred)
- `deps?: React.DependencyList` - Optional dependency list to re-subscribe when dynamic values change (e.g., room IDs)

**Features:**

- Automatically subscribes on mount
- Automatically unsubscribes on unmount
- Full TypeScript inference for event payloads based on router definition
- Compile-time type safety - catches invalid event names and incorrect payload types

## Features

- **Type Safety** - End-to-end type safety from server to client
- **Auto Reconnection** - Built-in reconnection with exponential backoff
- **Auto Cleanup** - Event listeners are automatically cleaned up
- **React Idiomatic** - Follows React patterns and best practices
- **Zero Config** - Works out of the box with sensible defaults

## Development

### Running Tests

```bash
bun test
```

For watch mode:

```bash
bun test:watch
```

See [TESTING.md](./TESTING.md) for detailed testing documentation.

### Building

```bash
bun run build
```

## License

MIT
