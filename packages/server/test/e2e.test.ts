import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { actor, createApp } from "../../core/src/index";
import { createBunHandlers, serve } from "../src/adapters/bun";
import { createClient } from "../../client/src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function waitFor(
  condition: () => boolean,
  timeout = 2000,
  interval = 10,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) return resolve();
      if (Date.now() - start > timeout)
        return reject(new Error("waitFor timed out"));
      setTimeout(check, interval);
    };
    check();
  });
}

// ---------------------------------------------------------------------------
// Actor definition
// ---------------------------------------------------------------------------

const Message = z.object({ text: z.string(), sentAt: z.number() });
type Message = z.infer<typeof Message>;

const ChatRoom = actor({
  state: z.object({
    members: z.array(z.string()).default([]),
    messages: z.array(Message).default([]),
  }),
  methods: {
    sendMessage: {
      input: z.object({ text: z.string() }),
      handler: async ({ state, emit, input }) => {
        const msg = { text: input.text, sentAt: Date.now() };
        state.messages.push(msg);
        emit("message", msg);
        return msg;
      },
    },
    getMessages: {
      handler: async ({ state }) => {
        return state.messages;
      },
    },
    addMember: {
      input: z.object({ name: z.string() }),
      handler: async ({ state, input }) => {
        state.members.push(input.name);
        return state.members.length;
      },
    },
  },
  events: {
    message: Message,
  },
});

const app = createApp({ actors: { chat: ChatRoom } });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Zocket v2 E2E", () => {
  let server: ReturnType<typeof serve>;
  let port: number;

  beforeAll(() => {
    server = serve(app, { port: 0 });
    port = server.port as number;
  });

  afterAll(() => {
    server.stop(true);
  });

  test("client can call a method and get a typed result", async () => {
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${port}` });
    try {
      await client.$ready;

      const before = Date.now();
      const msg = await client.chat("room-1").sendMessage({ text: "hello" });

      expect(msg.text).toBe("hello");
      expect(msg.sentAt).toBeGreaterThanOrEqual(before);
      expect(msg.sentAt).toBeLessThanOrEqual(Date.now());
    } finally {
      client.$close();
    }
  });

  test("client can subscribe to and unsubscribe from events", async () => {
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${port}` });
    try {
      await client.$ready;

      const room = client.chat("room-events");
      const received: Message[] = [];
      const unsub = room.on("message", (msg) => {
        received.push(msg);
      });

      await room.sendMessage({ text: "first" });
      await waitFor(() => received.length === 1);

      expect(received[0].text).toBe("first");
      expect(received[0].sentAt).toBeGreaterThan(0);

      unsub();

      await room.sendMessage({ text: "second" });
      await new Promise((r) => setTimeout(r, 50));

      expect(received.length).toBe(1);
    } finally {
      client.$close();
    }
  });

  test("client can subscribe to state and receive patches", async () => {
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${port}` });
    try {
      await client.$ready;

      const room = client.chat("room-state");

      type State = { members: string[]; messages: Message[] };
      const snapshots: State[] = [];
      const unsub = room.state.subscribe((state) => {
        snapshots.push(structuredClone(state));
      });

      await waitFor(() => snapshots.length >= 1);
      expect(snapshots[0]).toEqual({ members: [], messages: [] });

      await room.sendMessage({ text: "first" });
      await waitFor(() => snapshots.length >= 2);

      expect(snapshots[1].messages).toHaveLength(1);
      expect(snapshots[1].messages[0].text).toBe("first");
      expect(snapshots[1].members).toEqual([]);

      await room.sendMessage({ text: "second" });
      await waitFor(() => snapshots.length >= 3);

      expect(snapshots[2].messages).toHaveLength(2);
      expect(snapshots[2].messages[0].text).toBe("first");
      expect(snapshots[2].messages[1].text).toBe("second");

      expect(snapshots).toHaveLength(3);

      unsub();
    } finally {
      client.$close();
    }
  });

  test("multiple methods work on the same actor instance", async () => {
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${port}` });
    try {
      await client.$ready;

      const room = client.chat("room-multi");

      expect(await room.addMember({ name: "alice" })).toBe(1);
      expect(await room.addMember({ name: "bob" })).toBe(2);

      await room.sendMessage({ text: "hi from alice" });
      await room.sendMessage({ text: "hi from bob" });

      const messages = await room.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].text).toBe("hi from alice");
      expect(messages[1].text).toBe("hi from bob");
    } finally {
      client.$close();
    }
  });

  test("ref-counted handles survive partial dispose", async () => {
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${port}` });
    try {
      await client.$ready;

      // Simulate two "components" grabbing the same actor
      const handle1 = client.chat("room-refcount");
      const handle2 = client.chat("room-refcount");

      await handle1.sendMessage({ text: "from handle1" });

      // Dispose handle1 (simulates component unmount)
      handle1.$dispose();

      // handle2 should still work — the underlying impl has refCount > 0
      const msg = await handle2.sendMessage({ text: "from handle2" });
      expect(msg.text).toBe("from handle2");

      const messages = await handle2.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].text).toBe("from handle1");
      expect(messages[1].text).toBe("from handle2");
    } finally {
      client.$close();
    }
  });

  test("handle survives immediate dispose and reacquire", async () => {
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${port}` });
    try {
      await client.$ready;

      const first = client.chat("room-remount");
      first.$dispose();

      // React StrictMode can temporarily unmount and remount in the same tick.
      const second = client.chat("room-remount");

      const snapshots: { members: string[]; messages: Message[] }[] = [];
      const unsub = second.state.subscribe((state) => {
        snapshots.push(structuredClone(state));
      });

      await waitFor(() => snapshots.length >= 1);
      await second.addMember({ name: "strict-mode" });
      await waitFor(() => snapshots.some((s) => s.members.includes("strict-mode")));

      unsub();
    } finally {
      client.$close();
    }
  });

  test("passive listener receives events without prior RPC", async () => {
    const sender = createClient<typeof app>({ url: `ws://127.0.0.1:${port}` });
    const listener = createClient<typeof app>({ url: `ws://127.0.0.1:${port}` });
    try {
      await sender.$ready;
      await listener.$ready;

      const room = listener.chat("room-passive");
      const received: Message[] = [];

      room.on("message", (msg) => {
        received.push(msg);
      });

      // Small delay to let event:sub reach the server
      await new Promise((r) => setTimeout(r, 30));

      // Send from a different client — listener should get the event
      await sender.chat("room-passive").sendMessage({ text: "hello from sender" });

      await waitFor(() => received.length === 1);
      expect(received[0].text).toBe("hello from sender");
    } finally {
      sender.$close();
      listener.$close();
    }
  });

  test("pending RPCs reject when socket closes", async () => {
    const tempServer = serve(app, { port: 0 });
    const tempPort = tempServer.port as number;
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${tempPort}` });
    try {
      await client.$ready;

      const room = client.chat("room-disconnect");

      // Fire an RPC but kill the server before it responds...
      // Actually we'll close the client socket while an RPC is "in flight"
      // by issuing a long-running call and immediately closing.
      const promise = room.sendMessage({ text: "will fail" });

      // Close the socket immediately
      client.$close();

      await expect(promise).rejects.toThrow();
    } finally {
      tempServer.stop(true);
    }
  });

  test("rpcTimeout rejects after configured ms", async () => {
    // Start a server that intentionally never responds to RPCs
    const blackHole = Bun.serve({
      port: 0,
      fetch(req, server) {
        server.upgrade(req);
        return undefined;
      },
      websocket: {
        open() {},
        message() {},
        close() {},
      },
    });

    const client = createClient<typeof app>({
      url: `ws://127.0.0.1:${blackHole.port}`,
      rpcTimeout: 100,
    });
    try {
      await client.$ready;

      const room = client.chat("room-timeout");
      const start = Date.now();

      await expect(room.sendMessage({ text: "should timeout" })).rejects.toThrow("timed out");
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(500);
    } finally {
      client.$close();
      blackHole.stop(true);
    }
  });

  // -------------------------------------------------------------------------
  // Lifecycle hook tests
  // -------------------------------------------------------------------------

  test("onConnect fires when a client first subscribes to an actor", async () => {
    const lifecycleApp = createApp({
      actors: {
        tracked: actor({
          state: z.object({
            connections: z.array(z.string()).default([]),
          }),
          methods: {},
          onConnect({ state, connectionId }) {
            state.connections.push(connectionId);
          },
        }),
      },
    });

    const s = serve(lifecycleApp, { port: 0 });
    const c = createClient<typeof lifecycleApp>({ url: `ws://127.0.0.1:${s.port}` });
    try {
      await c.$ready;

      const handle = c.tracked("instance-1");
      const snapshots: { connections: string[] }[] = [];
      handle.state.subscribe((state) => snapshots.push(structuredClone(state)));

      await waitFor(() => snapshots.length >= 1);

      expect(snapshots.at(-1)!.connections.length).toBe(1);
      expect(typeof snapshots.at(-1)!.connections[0]).toBe("string");
    } finally {
      c.$close();
      s.stop(true);
    }
  });

  test("onDisconnect fires when a client connection closes", async () => {
    const lifecycleApp = createApp({
      actors: {
        tracked: actor({
          state: z.object({
            connected: z.array(z.string()).default([]),
          }),
          methods: {},
          onConnect({ state, connectionId }) {
            state.connected.push(connectionId);
          },
          onDisconnect({ state, connectionId }) {
            const idx = state.connected.indexOf(connectionId);
            if (idx !== -1) state.connected.splice(idx, 1);
          },
        }),
      },
    });

    const s = serve(lifecycleApp, { port: 0 });
    const watcher = createClient<typeof lifecycleApp>({ url: `ws://127.0.0.1:${s.port}` });
    const joiner = createClient<typeof lifecycleApp>({ url: `ws://127.0.0.1:${s.port}` });
    try {
      await watcher.$ready;
      await joiner.$ready;

      const snapshots: { connected: string[] }[] = [];
      watcher.tracked("instance-dc").state.subscribe((state) =>
        snapshots.push(structuredClone(state)),
      );

      await waitFor(() => snapshots.length >= 1);

      joiner.tracked("instance-dc").state.subscribe(() => {});
      await waitFor(() => snapshots.at(-1)!.connected.length === 2);

      joiner.$close();
      await waitFor(() => snapshots.at(-1)!.connected.length === 1, 3000);

      expect(snapshots.at(-1)!.connected.length).toBe(1);
    } finally {
      watcher.$close();
      s.stop(true);
    }
  });

  test("onDisconnect mutates state and patches are broadcast", async () => {
    const lifecycleApp = createApp({
      actors: {
        game: actor({
          state: z.object({
            players: z.array(z.object({
              name: z.string(),
              connId: z.string(),
            })).default([]),
          }),
          methods: {
            join: {
              input: z.object({ name: z.string() }),
              handler({ state, input, connectionId }) {
                state.players.push({ name: input.name, connId: connectionId });
              },
            },
          },
          onDisconnect({ state, connectionId }) {
            const idx = state.players.findIndex((p) => p.connId === connectionId);
            if (idx !== -1) state.players.splice(idx, 1);
          },
        }),
      },
    });

    const s = serve(lifecycleApp, { port: 0 });
    const watcher = createClient<typeof lifecycleApp>({ url: `ws://127.0.0.1:${s.port}` });
    const player = createClient<typeof lifecycleApp>({ url: `ws://127.0.0.1:${s.port}` });
    try {
      await watcher.$ready;
      await player.$ready;

      const snapshots: { players: { name: string; connId: string }[] }[] = [];
      watcher.game("room-dc").state.subscribe((state) =>
        snapshots.push(structuredClone(state)),
      );

      await waitFor(() => snapshots.length >= 1);

      await player.game("room-dc").join({ name: "Alice" });
      await waitFor(() => snapshots.at(-1)!.players.length === 1);
      expect(snapshots.at(-1)!.players[0].name).toBe("Alice");

      player.$close();
      await waitFor(() => snapshots.at(-1)!.players.length === 0, 3000);

      expect(snapshots.at(-1)!.players).toEqual([]);
    } finally {
      watcher.$close();
      s.stop(true);
    }
  });

  test("connectionId is available inside method handlers", async () => {
    const lifecycleApp = createApp({
      actors: {
        echo: actor({
          state: z.object({}).default({}),
          methods: {
            whoAmI: {
              handler({ connectionId }) {
                return connectionId;
              },
            },
          },
        }),
      },
    });

    const s = serve(lifecycleApp, { port: 0 });
    const c = createClient<typeof lifecycleApp>({ url: `ws://127.0.0.1:${s.port}` });
    try {
      await c.$ready;
      const connId = await c.echo("inst-1").whoAmI();
      expect(typeof connId).toBe("string");
      expect((connId as string).length).toBeGreaterThan(0);

      const connId2 = await c.echo("inst-1").whoAmI();
      expect(connId2).toBe(connId);
    } finally {
      c.$close();
      s.stop(true);
    }
  });

  describe("Robustness", () => {
    test("validation errors are returned as RPC errors", async () => {
      const c = createClient<typeof app>({ url: `ws://127.0.0.1:${port}` });
      try {
        await c.$ready;
        await expect((c.chat("room-validate") as any).sendMessage({})).rejects.toThrow(
          "Validation failed for sendMessage",
        );
      } finally {
        c.$close();
      }
    });

    test("unknown methods are returned as RPC errors", async () => {
      const c = createClient<typeof app>({ url: `ws://127.0.0.1:${port}` });
      try {
        await c.$ready;
        await expect((c.chat("room-unknown") as any).doesNotExist()).rejects.toThrow(
          "Unknown method: doesNotExist",
        );
      } finally {
        c.$close();
      }
    });

    test("concurrent RPCs on the same actor are serialized through the actor queue", async () => {
      const queuedApp = createApp({
        actors: {
          counter: actor({
            state: z.object({
              count: z.number().default(0),
              order: z.array(z.string()).default([]),
            }),
            methods: {
              incrementSlow: {
                input: z.object({ label: z.string(), waitMs: z.number() }),
                async handler({ state, input }) {
                  state.order.push(`start:${input.label}`);
                  await new Promise((resolve) => setTimeout(resolve, input.waitMs));
                  state.count += 1;
                  state.order.push(`end:${input.label}`);
                  return state.count;
                },
              },
              getState: {
                handler({ state }) {
                  return state;
                },
              },
            },
          }),
        },
      });

      const s = serve(queuedApp, { port: 0 });
      const c = createClient<typeof queuedApp>({ url: `ws://127.0.0.1:${s.port}` });
      try {
        await c.$ready;
        const counter = c.counter("serialized");

        const first = counter.incrementSlow({ label: "first", waitMs: 30 });
        const second = counter.incrementSlow({ label: "second", waitMs: 0 });

        await expect(first).resolves.toBe(1);
        await expect(second).resolves.toBe(2);

        const state = await counter.getState();
        expect(state.count).toBe(2);
        expect(state.order).toEqual([
          "start:first",
          "end:first",
          "start:second",
          "end:second",
        ]);
      } finally {
        c.$close();
        s.stop(true);
      }
    });
  });

  test("createBunHandlers integrates with Bun.serve()", async () => {
    const handlers = createBunHandlers(app);

    expect(handlers.fetch).toBeFunction();
    expect(handlers.websocket.open).toBeFunction();
    expect(handlers.websocket.message).toBeFunction();
    expect(handlers.websocket.close).toBeFunction();

    const customServer = Bun.serve({
      port: 0,
      fetch: handlers.fetch,
      websocket: handlers.websocket,
    });

    const customClient = createClient<typeof app>({
      url: `ws://127.0.0.1:${customServer.port}`,
    });
    try {
      await customClient.$ready;

      const before = Date.now();
      const result = await customClient.chat("custom-room").sendMessage({ text: "custom" });
      expect(result.text).toBe("custom");
      expect(result.sentAt).toBeGreaterThanOrEqual(before);
    } finally {
      customClient.$close();
      customServer.stop(true);
    }
  });
});
