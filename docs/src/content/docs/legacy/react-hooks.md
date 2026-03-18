---
title: React Hooks (v1)
description: "[Legacy v1] useEvent, useConnectionState, and more"
---

> **This documents the old v1 API.** See [React Hooks](/react/hooks/) for the current version.

## useClient

```tsx
const client = zocket.useClient();
```

## useConnectionState

```tsx
const { status, lastError } = zocket.useConnectionState();
// status: "connecting" | "open" | "closed"
```

## useEvent

```tsx
zocket.useEvent(client.on.chat.message, (msg) => {
  setMessages(prev => [...prev, msg]);
});
```

## Data Fetching (TanStack Query)

```tsx
import { useQuery } from "@tanstack/react-query";

function Profile({ userId }) {
  const client = zocket.useClient();
  const profile = useQuery({
    queryKey: ["users.getProfile", userId],
    queryFn: () => client.users.getProfile({ id: userId }),
  });
  return <pre>{JSON.stringify(profile.data, null, 2)}</pre>;
}
```
