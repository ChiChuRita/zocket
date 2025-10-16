# Zocket Chat Demo

A minimal real-time chat application built with Zocket, demonstrating WebSocket communication between a Bun server and React client with full type safety.

## Features

- 🚀 Real-time messaging using WebSockets
- 🔒 End-to-end type safety with TypeScript
- 📝 Server-side logging middleware
- 🎨 Modern, responsive UI
- 🔄 Broadcast messages to all connected clients

## Architecture

- **Server** (`server.ts`): Bun WebSocket server using `@zocket/core`
- **Client** (`src/App.tsx`): React app using `@zocket/react` hooks
- **Shared Types** (`shared.ts`): Type-safe router definition

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Start the server

In one terminal:

```bash
bun run server
```

The server will start on `ws://localhost:3000`

### 3. Start the React app

In another terminal:

```bash
bun run dev
```

The app will open at `http://localhost:5173`

### 4. Use the chat

1. Enter a username to join the chat
2. Type messages and click "Send" (or press Enter)
3. Open multiple browser tabs to test multi-user chat
4. Watch the server terminal to see logged messages

## Server Middleware

The server includes a logging middleware that logs all incoming messages:

```typescript
zo.message.incoming({...}).use(({ payload, ctx }) => {
  console.log(`📨 [${ctx.user}] sent: "${payload.text}"`);
})
```

You'll see messages like:

- `✅ alice connected (client_123...)`
- `📨 [alice] sent: "Hello everyone!"`
- `📤 Broadcasting message from alice`
- `❌ alice disconnected (client_123...)`

## Router Definition

The chat uses a simple router with two message types:

- `chat.sendMessage` (incoming): Client sends message to server
- `chat.messageReceived` (outgoing): Server broadcasts message to all clients

## Type Safety

The router type is shared between server and client via `shared.ts`, ensuring full type safety when sending and receiving messages. TypeScript will catch any mismatched message types or payloads at compile time.
