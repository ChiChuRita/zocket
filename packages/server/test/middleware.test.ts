import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { actor, createApp, middleware } from "../../core/src/index";
import { MSG } from "../../core/src/protocol";
import { serve } from "../src/adapters/bun";
import { createHandlers } from "../src/index";
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
// Middleware tests
// ---------------------------------------------------------------------------

describe("Middleware", () => {
  test("middleware context flows to handler", async () => {
    const authed = middleware().use(async ({ connectionId }) => {
      return { userId: `user-${connectionId}` };
    });

    const MyActor = authed.actor({
      state: z.object({}).default({}),
      methods: {
        whoAmI: {
          handler: ({ ctx }) => {
            return ctx.userId;
          },
        },
      },
    });

    const app = createApp({ actors: { my: MyActor } });
    const server = serve(app, { port: 0 });
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${server.port}` });
    try {
      await client.$ready;
      const result = await client.my("inst-1").whoAmI();
      expect(typeof result).toBe("string");
      expect((result as string).startsWith("user-")).toBe(true);
    } finally {
      client.$close();
      server.stop(true);
    }
  });

  test("middleware chain accumulates context", async () => {
    const chain = middleware()
      .use(async () => ({ a: 1 }))
      .use(async ({ ctx }) => ({ b: ctx.a + 10 }));

    const MyActor = chain.actor({
      state: z.object({}).default({}),
      methods: {
        getCtx: {
          handler: ({ ctx }) => {
            return { a: ctx.a, b: ctx.b };
          },
        },
      },
    });

    const app = createApp({ actors: { my: MyActor } });
    const server = serve(app, { port: 0 });
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${server.port}` });
    try {
      await client.$ready;
      const result = (await client.my("inst-1").getCtx()) as { a: number; b: number };
      expect(result.a).toBe(1);
      expect(result.b).toBe(11);
    } finally {
      client.$close();
      server.stop(true);
    }
  });

  test("middleware throwing blocks handler and returns RPC error", async () => {
    const guarded = middleware().use(async () => {
      throw new Error("Forbidden");
    });

    const MyActor = guarded.actor({
      state: z.object({ count: z.number().default(0) }),
      methods: {
        increment: {
          handler: ({ state }) => {
            state.count++;
          },
        },
      },
    });

    const app = createApp({ actors: { my: MyActor } });
    const server = serve(app, { port: 0 });
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${server.port}` });
    try {
      await client.$ready;
      await expect(client.my("inst-1").increment()).rejects.toThrow("Forbidden");

      // State should be unchanged — subscribe and check
      const snapshots: { count: number }[] = [];
      client.my("inst-1").state.subscribe((s) => snapshots.push(structuredClone(s)));
      await waitFor(() => snapshots.length >= 1);
      expect(snapshots[0].count).toBe(0);
    } finally {
      client.$close();
      server.stop(true);
    }
  });

  test("middleware throwing prevents subsequent middleware from running", async () => {
    let secondRan = false;

    const chain = middleware()
      .use(async () => {
        throw new Error("First fails");
      })
      .use(async () => {
        secondRan = true;
        return {};
      });

    const MyActor = chain.actor({
      state: z.object({}).default({}),
      methods: {
        doSomething: { handler: () => {} },
      },
    });

    const app = createApp({ actors: { my: MyActor } });
    const server = serve(app, { port: 0 });
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${server.port}` });
    try {
      await client.$ready;
      await expect(client.my("inst-1").doSomething()).rejects.toThrow("First fails");
      expect(secondRan).toBe(false);
    } finally {
      client.$close();
      server.stop(true);
    }
  });

  test("async middleware works", async () => {
    const chain = middleware().use(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { delayed: true };
    });

    const MyActor = chain.actor({
      state: z.object({}).default({}),
      methods: {
        check: {
          handler: ({ ctx }) => ctx.delayed,
        },
      },
    });

    const app = createApp({ actors: { my: MyActor } });
    const server = serve(app, { port: 0 });
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${server.port}` });
    try {
      await client.$ready;
      const result = await client.my("inst-1").check();
      expect(result).toBe(true);
    } finally {
      client.$close();
      server.stop(true);
    }
  });

  test("backward compatibility — actor() without middleware still works", async () => {
    const MyActor = actor({
      state: z.object({ count: z.number().default(0) }),
      methods: {
        increment: {
          handler: ({ state }) => {
            state.count++;
            return state.count;
          },
        },
      },
    });

    const app = createApp({ actors: { my: MyActor } });
    const server = serve(app, { port: 0 });
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${server.port}` });
    try {
      await client.$ready;
      const result = await client.my("inst-1").increment();
      expect(result).toBe(1);
      const result2 = await client.my("inst-1").increment();
      expect(result2).toBe(2);
    } finally {
      client.$close();
      server.stop(true);
    }
  });

  test("middleware receives correct args", async () => {
    let capturedArgs: Record<string, unknown> | null = null;

    const chain = middleware().use(async (args) => {
      capturedArgs = { ...args };
      return {};
    });

    const MyActor = chain.actor({
      state: z.object({}).default({}),
      methods: {
        ping: { handler: () => "pong" },
      },
    });

    const app = createApp({ actors: { my: MyActor } });
    const server = serve(app, { port: 0 });
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${server.port}` });
    try {
      await client.$ready;
      await client.my("test-id").ping();
      expect(capturedArgs).not.toBeNull();
      expect(typeof capturedArgs!.connectionId).toBe("string");
      expect(capturedArgs!.actor).toBe("my");
      expect(capturedArgs!.actorId).toBe("test-id");
      expect(capturedArgs!.method).toBe("ping");
      expect(capturedArgs!.ctx).toEqual({});
    } finally {
      client.$close();
      server.stop(true);
    }
  });

  test("multiple actors can share the same middleware chain", async () => {
    const authed = middleware().use(async () => ({ role: "admin" }));

    const ActorA = authed.actor({
      state: z.object({}).default({}),
      methods: {
        getRole: { handler: ({ ctx }) => ctx.role },
      },
    });

    const ActorB = authed.actor({
      state: z.object({}).default({}),
      methods: {
        getRole: { handler: ({ ctx }) => ctx.role },
      },
    });

    const app = createApp({ actors: { a: ActorA, b: ActorB } });
    const server = serve(app, { port: 0 });
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${server.port}` });
    try {
      await client.$ready;
      const roleA = await client.a("inst-1").getRole();
      const roleB = await client.b("inst-1").getRole();
      expect(roleA).toBe("admin");
      expect(roleB).toBe("admin");
    } finally {
      client.$close();
      server.stop(true);
    }
  });

  test("middleware receives transport auth metadata", async () => {
    const authed = middleware().use(async ({ connectionId, userId, claims, scope }) => {
      return {
        connectionId,
        userId,
        role: claims.role,
        workspaceId: scope?.workspaceId ?? null,
        projectId: scope?.projectId ?? null,
      };
    });

    const MyActor = authed.actor({
      state: z.object({}).default({}),
      methods: {
        getSession: {
          handler: ({ ctx }) => ctx,
        },
      },
    });

    const handlers = createHandlers(createApp({ actors: { my: MyActor } }));
    const sent: string[] = [];
    const connection = {
      id: "session-1",
      userId: "user-123",
      claims: { role: "admin", sub: "user-123" },
      scope: { workspaceId: "ws-1", projectId: "prj-1" },
      send(message: string) {
        sent.push(message);
      },
    };

    await handlers.onMessage(connection, JSON.stringify({
      type: MSG.RPC,
      id: "rpc-1",
      actor: "my",
      actorId: "inst-1",
      method: "getSession",
    }));

    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0])).toEqual({
      type: MSG.RPC_RESULT,
      id: "rpc-1",
      result: {
        connectionId: "session-1",
        userId: "user-123",
        role: "admin",
        workspaceId: "ws-1",
        projectId: "prj-1",
      },
    });
  });

  test("lifecycle hooks receive transport auth metadata", async () => {
    const MyActor = actor({
      state: z.object({
        connections: z.array(
          z.object({
            connectionId: z.string(),
            userId: z.union([z.string(), z.null()]),
            projectId: z.union([z.string(), z.null()]),
            role: z.union([z.string(), z.null()]),
          }),
        ).default([]),
        disconnected: z.array(z.string()).default([]),
      }),
      methods: {
        ping: {
          handler: () => "pong",
        },
      },
      onConnect({ state, connectionId, userId, claims, scope }) {
        state.connections.push({
          connectionId,
          userId,
          projectId: scope?.projectId ?? null,
          role: typeof claims.role === "string" ? claims.role : null,
        });
      },
      onDisconnect({ state, connectionId }) {
        state.disconnected.push(connectionId);
      },
    });

    const handlers = createHandlers(createApp({ actors: { my: MyActor } }));
    const connection = {
      id: "session-2",
      userId: "user-456",
      claims: { role: "member" },
      scope: { workspaceId: "ws-1", projectId: "prj-9" },
      send(_message: string) {},
    };

    await handlers.onMessage(connection, JSON.stringify({
      type: MSG.STATE_SUB,
      actor: "my",
      actorId: "inst-2",
    }));

    const instance = await handlers.manager.getOrCreate("my", "inst-2");
    expect(instance.getState()).toEqual({
      connections: [
        {
          connectionId: "session-2",
          userId: "user-456",
          projectId: "prj-9",
          role: "member",
        },
      ],
      disconnected: [],
    });

    handlers.onClose(connection);

    expect(instance.getState()).toEqual({
      connections: [
        {
          connectionId: "session-2",
          userId: "user-456",
          projectId: "prj-9",
          role: "member",
        },
      ],
      disconnected: ["session-2"],
    });
  });

  test("middleware does NOT run for lifecycle hooks", async () => {
    let middlewareCallCount = 0;

    const chain = middleware().use(async () => {
      middlewareCallCount++;
      return {};
    });

    const MyActor = chain.actor({
      state: z.object({ connections: z.array(z.string()).default([]) }),
      methods: {
        ping: { handler: () => "pong" },
      },
      onConnect({ state, connectionId }) {
        state.connections.push(connectionId);
      },
    });

    const app = createApp({ actors: { my: MyActor } });
    const server = serve(app, { port: 0 });
    const client = createClient<typeof app>({ url: `ws://127.0.0.1:${server.port}` });
    try {
      await client.$ready;

      // Subscribe to state to trigger onConnect
      const snapshots: { connections: string[] }[] = [];
      client.my("inst-1").state.subscribe((s) => snapshots.push(structuredClone(s)));
      await waitFor(() => snapshots.length >= 1);

      // onConnect ran (state has connection) but middleware didn't run yet
      expect(snapshots.at(-1)!.connections.length).toBe(1);
      expect(middlewareCallCount).toBe(0);

      // Now call a method — middleware should run
      await client.my("inst-1").ping();
      expect(middlewareCallCount).toBe(1);
    } finally {
      client.$close();
      server.stop(true);
    }
  });
});
