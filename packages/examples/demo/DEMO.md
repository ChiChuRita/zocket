# Zocket Ping Pong Demo

A real-time multiplayer ping pong game built with Zocket, demonstrating advanced WebSocket features including rooms, real-time game state synchronization, and client-side interpolation.

## Features

- 🎮 Real-time multiplayer ping pong game
- 🚀 Room-based matchmaking (share URL to play with friends)
- 🔒 End-to-end type safety with TypeScript
- 🎯 Client-side interpolation for smooth gameplay
- 📊 Live scoreboard
- 🎨 Beautiful canvas rendering with React Konva
- 👥 Spectator mode when rooms are full

## Architecture

- **Server** (`server.ts`): Bun WebSocket server with game loop running at 30 FPS
- **Client** (`src/App.tsx`): React app with canvas rendering and input handling
- **Shared Types** (`shared.ts`): Type-safe router definition
- **Game State**: Server-authoritative with client-side prediction

## Getting Started

### Quick Start (One Command)

```bash
bun run dev:all
```

This starts both the server and client in one terminal!

### Alternative: Separate Terminals

#### 1. Install dependencies

```bash
bun install
```

#### 2. Start the server

In one terminal:

```bash
bun run dev:server
```

The server will start on `ws://localhost:3000`

#### 3. Start the React app

In another terminal:

```bash
bun run dev
```

The app will open at `http://localhost:5173`

## How to Play

1. **Enter your username** to join
2. **Automatic room assignment**:
   - First player becomes left paddle (blue)
   - Second player becomes right paddle (red)
   - Additional players become spectators
3. **Controls**: Use ↑ and ↓ arrow keys to move your paddle
4. **Share the room URL** from the browser to invite another player
5. **Score points** by getting the ball past your opponent's paddle

## Game Features

### Room System

- Each game session has a unique room ID (from URL parameter)
- Share the URL to play with specific friends
- Automatic room creation on first join

### Player Assignment

- **Left Player** (Blue): First to join the room
- **Right Player** (Red): Second to join the room
- **Spectators**: Anyone else who joins

### Game Physics

- Ball speeds up slightly on each paddle hit
- Paddle hit angle affects ball trajectory
- Wall bounces preserve momentum
- Automatic serve after scoring

### Client-Side Interpolation

- Smooth 60 FPS rendering on client
- Server runs at 30 FPS for efficiency
- Interpolation between server updates for fluid gameplay

## Technical Highlights

### Zocket Features Demonstrated

1. **Rooms API**: `ctx.rooms.join()`, `ctx.rooms.has()`, `ctx.rooms.broadcast()`
2. **Context Management**: User headers and client tracking
3. **Real-time Broadcasting**: Game state updates to all room members
4. **Type-Safe Messaging**: Full TypeScript support from server to client
5. **Connection Lifecycle**: `onConnect` and `onDisconnect` hooks

### Server-Side Game Loop

```typescript
const gameLoop = setInterval(() => {
  // Update paddle positions
  // Move ball
  // Check collisions
  // Update scores
  // Broadcast state to room
}, 1000 / 30); // 30 FPS
```

### Client-Side Interpolation

```typescript
const interpolate = () => {
  const t = Math.min(timeSinceUpdate / SERVER_UPDATE_INTERVAL, 1);
  const interpolatedState = {
    ball: { x: lerp(prev.x, current.x, t), ... },
    paddles: { ... }
  };
  render(interpolatedState);
};
```

## Scripts

- `bun run dev:all` - Start both server and client (recommended)
- `bun run dev` - Start client only
- `bun run dev:server` - Start server only
- `bun run build` - Build for production
- `bun run preview` - Preview production build

## Type Safety

The router type is shared between server and client via `shared.ts`:

```typescript
export type GameRouter = typeof gameRouter;
```

This ensures full type safety when sending and receiving messages. TypeScript will catch any mismatched message types or payloads at compile time.

## Next Steps

Want to extend this demo? Try adding:

- Power-ups
- Multiple ball modes
- Tournament brackets
- Persistent high scores
- AI opponent
- Custom paddle/ball skins

Check out the [demo-chat](../demo-chat) example for a full-featured chat application!
