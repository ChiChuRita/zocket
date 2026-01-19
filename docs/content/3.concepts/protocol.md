---
title: Protocol
description: Detailed technical specification of the Zocket message protocol
icon: lucide:code
---

Zocket uses a simple, JSON-based protocol over standard WebSockets. This document specifies the message formats and connection lifecycle.

## Transport & Serialization

- **Transport**: Standard WebSockets (`ws://` or `wss://`).
- **Serialization**: Every message is a JSON-encoded object. Binary formats are currently not supported but are on the roadmap.

## Connection Lifecycle

### Handshake & Authentication

Because the browser's native `WebSocket` API does not support custom HTTP headers, Zocket uses **URL Query Parameters** for initial authentication.

1.  The client connects to the server URL (e.g., `ws://api.example.com`).
2.  Headers defined in `zocket.create({ headers: ... })` are passed as query parameters:
    `ws://api.example.com?authorization=Bearer+token123&version=1.0`
3.  The server maps these query parameters back into an internal headers object.
4.  The server validates the headers against the schema before completing the WebSocket upgrade.

### Client ID

Upon successful connection, the server assigns a unique `clientId` (e.g., `client_1705680000000_abc123`). This ID is used for private messaging and tracking connection state.

### Protocol Versioning

To ensure compatibility between the client and server, `@zocket/client` automatically appends its version to the connection handshake.

- **Query Parameter**: `x-zocket-version` (e.g., `0.1.0`)
- **Server Behavior**: The server extracts this version and compares it with its own. If there is a mismatch, the server will log a warning. In future versions, the server may optionally reject incompatible clients to prevent runtime errors.

## Message Formats

All messages (Client → Server and Server → Client) follow a consistent structure.

### Standard Message

Used for fire-and-forget messaging or server-pushed updates.

```json
{
  "type": "chat.message",
  "payload": {
    "text": "Hello, world!",
    "from": "user_1"
  }
}
```

- `type`: (String) The dot-notated route path defined in the router.
- `payload`: (Any) The data being sent, validated against the route's schema.

### RPC (Request/Response)

When a client expects a response from a handler, it includes an `rpcId`.

**Request (Client → Server):**
```json
{
  "type": "users.getProfile",
  "payload": { "id": "123" },
  "rpcId": "unique-msg-id-456"
}
```

**Response (Server → Client):**
```json
{
  "type": "__rpc_res",
  "payload": { "name": "John Doe", "email": "john@example.com" },
  "rpcId": "unique-msg-id-456"
}
```

- `type`: Always `__rpc_res` for server responses.
- `rpcId`: Matches the ID sent in the request.
- `payload`: The return value of the server handler.

## Internal Mechanisms

### Efficient Broadcasting

For performance, Zocket uses a reserved internal topic called `__zocket_all__`.

1.  Every client is automatically subscribed to `__zocket_all__` on connection.
2.  When `ctx.send.path.broadcast()` is called, the server uses the native adapter's `publish` method (e.g., `Bun.publish`) to send the message to the global topic in a single operation.
3.  This avoids a JavaScript loop over all connected clients, providing performance close to raw sockets.

### Rooms

Rooms are implemented using the underlying WebSocket engine's pub/sub system.

- **Joining**: Server calls `ws.subscribe(roomId)`.
- **Leaving**: Server calls `ws.unsubscribe(roomId)`.
- **Broadcasting**: `ctx.rooms.broadcast(roomId, ...)` uses native `publish` to the room topic.
