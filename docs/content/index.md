---
layout: default
navigation: false
title: Home
---

::Hero
---
title: Zocket
description: Type-safe WebSocket library with end-to-end type safety. Build real-time apps with confidence.
actions:
  - name: Get Started
    to: /introduction
    variant: default
  - name: GitHub
    to: https://github.com/ChiChuRita/zocket
    target: _blank
    variant: outline
    icon: lucide:github
---
::

::CardGroup
  ::Card
  ---
  title: End-to-end Type Safety
  icon: lucide:shield-check
  ---
  Full TypeScript inference from server to client. Change your server code, and your client code updates automatically.
  ::
  ::Card
  ---
  title: Schema Validation
  icon: lucide:check-circle-2
  ---
  Works with Zod, Valibot, and any Standard Schema compatible library.
  ::
  ::Card
  ---
  title: Real-time Rooms
  icon: lucide:users
  ---
  Built-in support for WebSocket rooms/channels for targeted broadcasting.
  ::
  ::Card
  ---
  title: Runtime Agnostic
  icon: lucide:zap
  ---
  Works with Bun, Node.js, Deno, and browsers. Framework agnostic.
  ::
::CardGroup
