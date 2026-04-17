# Counter Example

A current standalone Zocket example built around one shared `counter(id)` actor.

It demonstrates:

- `actor(...)` plus `createApp(...)`
- local serving with `serve(...)` from `@zocket/server/bun`
- `createClient(...)` plus `createZocketReact(...)`
- `ZocketProvider`, `useActor`, `useActorState`, `useEvent`, and `useConnectionStatus`
- selector-based state reads instead of manual DOM subscriptions
- lifecycle-managed event listeners instead of manual cleanup
- `onConnect` and `onDisconnect` presence tracking

The browser app is now intentionally React-first: multiple components resolve the same `counter(id)` actor independently and let Zocket manage the shared handle lifecycle.

## Run It

From the repo root:

```bash
bun install

# terminal 1
bun run --cwd examples/counter dev:server

# terminal 2
bun run --cwd examples/counter/client dev
```

Open [http://localhost:5173](http://localhost:5173).

The path becomes the actor id, so `/main` and `/team-a` connect to different live counters.

If port `3000` is already occupied, start the server on another port and point the client at it:

```bash
PORT=3100 bun run --cwd examples/counter dev:server
VITE_ZOCKET_URL=ws://127.0.0.1:3100 bun run --cwd examples/counter/client dev
```
