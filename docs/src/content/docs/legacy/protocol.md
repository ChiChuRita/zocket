---
title: Protocol (v1)
description: "[Legacy v1] Message protocol specification"
---

> **This documents the old v1 API.** See [Protocol](/core/protocol/) for the current version.

Zocket uses a simple, JSON-based protocol over standard WebSockets.

## Transport & Serialization

- **Transport**: Standard WebSockets (`ws://` or `wss://`).
- **Serialization**: Every message is a JSON-encoded object.

## Connection Lifecycle

### Handshake & Authentication

Because the browser's native `WebSocket` API does not support custom HTTP headers, Zocket uses **URL Query Parameters** for initial authentication.

1. The client connects to the server URL
2. Headers defined in `zocket.create({ headers: ... })` are passed as query parameters
3. The server validates the headers against the schema before completing the WebSocket upgrade

### Client ID

Upon successful connection, the server assigns a unique `clientId`.

### Protocol Versioning

`@zocket/client` automatically appends its version via the `x-zocket-version` query parameter.

## Message Formats

### Standard Message

```json
{
  "type": "chat.message",
  "payload": { "text": "Hello!", "from": "user_1" }
}
```

### RPC (Request/Response)

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
  "payload": { "name": "John" },
  "rpcId": "unique-msg-id-456"
}
```

## Internal Mechanisms

### Efficient Broadcasting

Zocket uses a reserved internal topic `__zocket_all__` for global broadcast using the native adapter's `publish` method.

### Rooms

Rooms are implemented using the underlying WebSocket engine's pub/sub system (`ws.subscribe(roomId)`, `ws.unsubscribe(roomId)`).
