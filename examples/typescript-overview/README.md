# TypeScript Overview

A single TypeScript file that shows the core Zocket flow without any HTML or React:

- define an actor with typed state, methods, and events
- start a WebSocket server
- connect a typed client
- call actor methods
- subscribe to connection status, events, and state

## Run it

From the repo root:

```bash
bun install
bun run --cwd examples/typescript-overview start
```

For a watch loop:

```bash
bun run --cwd examples/typescript-overview dev
```
