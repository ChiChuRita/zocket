# Zocket Drawing Guess Example

This example is a small multiplayer drawing-and-guessing game built on the current actor API.

It demonstrates:

- one shared actor instance for the whole room
- state snapshots plus incremental patches for strokes, guesses, scores, and presence
- transient events alongside state sync for the activity feed
- typed actor methods from React
- a visual canvas so cross-tab state updates are obvious

## Run it

From the repo root:

```bash
bun install

# terminal 1
bun run --cwd packages/example dev:server

# terminal 2
bun run --cwd packages/example dev:web -- --host localhost
```

Open [http://localhost:5173](http://localhost:5173).

## How to test it

1. Open the app in two tabs.
2. Give each tab a different player name.
3. Start a round.
4. Draw in the drawer tab and guess in the other tab.

You should see:

- strokes appear in both tabs from shared actor state
- guesses update in both tabs
- score changes after a correct guess
- the raw synced snapshot in the Snapshot tab
