---
title: Limitations (v1)
description: "[Legacy v1] Known limitations of the v1 API"
---

> **This documents the old v1 API.** See [Getting Started](/getting-started/) for the current version.

## Resilience & Connection Management

- No auto-reconnection
- No backoff strategies
- No heartbeats/ping-pong

## React State Management

- No caching/deduplication
- No window focus refetching
- No optimistic updates

## Configuration & Timeouts

- Hardcoded 10-second RPC timeout
- JSON serialization only

## Scalability

- Single-node pub/sub only
- No distributed pub/sub adapter

## Testing

- Requires full WebSocket server for testing
- No mock utilities
