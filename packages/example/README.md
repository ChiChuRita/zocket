# Zocket Example App

A full-stack demo showcasing Zocket features: header validation, middleware, rooms, server push, and RPC with TanStack Query.

## Run it

From the repo root:

```bash
# install deps if you haven't already
bun install

# terminal 1 - bun websocket server
bun run --cwd packages/example dev:server

# terminal 2 - vite + react client
bun run --cwd packages/example dev:web
```

Open `http://localhost:5173` in your browser.

## What it demonstrates

- Header schema + `onConnect`/`onDisconnect` context
- Middleware chains (`withTrace`, `adminGate`)
- Rooms (`join`, `leave`, `toRoom`)
- `send.to`, `send.toRoom`, and `send.broadcast`
- Server push via `handlers.send` interval
- RPC calls with TanStack Query
- Zocket React hooks (`useClient`, `useConnectionState`, `useEvent`)
