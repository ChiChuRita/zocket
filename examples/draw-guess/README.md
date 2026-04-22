# Draw & Guess Example

A tiny multiplayer "pictionary" built on a single Zocket actor.

The **server** is the point of this example — keep an eye on
[`actors.ts`](./actors.ts). About 100 lines of code gives you:

- rooms by URL path (`/main`, `/team-a`, …)
- a rotating drawer whose strokes are broadcast to everyone
- a private word, held server-side and never put on the wire except to the drawer
- validated guesses, a scoreboard, and automatic cleanup on disconnect

The browser client is a thin React app that draws on a `<canvas>` and
renders events. All game rules live on the server.

## Run it

```bash
bun install

# terminal 1
bun run --cwd examples/draw-guess dev:server

# terminal 2
bun run --cwd examples/draw-guess/client dev
```

Open [http://localhost:5173](http://localhost:5173) in two browser tabs.
Enter a name in each, then click **"I'll draw next"** in one of them.
The URL path is the room id, so `/friends` and `/work` are independent rooms.

If port `3000` is taken:

```bash
PORT=3100 bun run --cwd examples/draw-guess dev:server
VITE_ZOCKET_URL=ws://127.0.0.1:3100 bun run --cwd examples/draw-guess/client dev
```

## How it fits together

| Actor piece      | Role                                                                 |
|------------------|----------------------------------------------------------------------|
| `state`          | players, current phase, drawer, masked hint — replicated to clients  |
| `secretByDrawer` | **Server-only** map holding the secret word for the active drawer    |
| `stroke` event   | broadcast fan-out of each line segment                               |
| `guess` method   | server compares the guess to the private word and awards points      |
| `onDisconnect`   | removes the player, ends the round if the drawer dropped             |
