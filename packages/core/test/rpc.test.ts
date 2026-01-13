import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { zocket, createBunServer } from "../src/index";
import { createZocketClient } from "../../client/src/index";

describe("RPC and Unified API", () => {
  let server: any;
  let port: number;

  const zo = zocket.create({
    headers: z.object({}),
  });

  const appRouter = zo
    .router()
    .outgoing({
      message: z.string(),
    })
    .incoming(({ send }) => ({
      // RPC: Returns a value
      greet: zo.message
        .input(z.object({ name: z.string() }))
        .handle(({ input }) => {
          return `Hello, ${input.name}!`;
        }),

      // Fire-and-forget: Returns void
      log: zo.message.input(z.string()).handle(({ input }) => {
        console.log(`LOG: ${input}`);
      }),

      // Async RPC
      delayedEcho: zo.message.input(z.string()).handle(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return `Echo: ${input}`;
      }),

      trigger: zo.message.input(z.string()).handle(({ input }) => {
        send.message(input).broadcast();
      }),
    }));

  type AppRouter = typeof appRouter;

  beforeAll(() => {
    const handlers = createBunServer(appRouter, zo);
    server = Bun.serve({
      fetch: handlers.fetch,
      websocket: handlers.websocket,
      port: 0,
      hostname: "127.0.0.1",
    });
    port = server.port;
  });

  afterAll(() => {
    server.stop(true);
  });

  test("unified API: can call RPC and get response", async () => {
    const client = createZocketClient<AppRouter>(`ws://127.0.0.1:${port}`);

    await new Promise<void>((resolve) => {
      client.onOpen(resolve);
    });

    const result = await client.greet({ name: "World" });
    expect(result).toBe("Hello, World!");

    client.close();
  });

  test("unified API: can call async RPC", async () => {
    const client = createZocketClient<AppRouter>(`ws://127.0.0.1:${port}`);

    await new Promise<void>((resolve) => {
      client.onOpen(resolve);
    });

    const result = await client.delayedEcho("test");
    expect(result).toBe("Echo: test");

    client.close();
  });

  test("unified API: can call fire-and-forget", async () => {
    const client = createZocketClient<AppRouter>(`ws://127.0.0.1:${port}`);

    await new Promise<void>((resolve) => {
      client.onOpen(resolve);
    });

    // This should resolve immediately (well, as soon as it's sent)
    // and it will technically return a Promise because of our unified proxy,
    // but the server will send back undefined.
    const result = await client.log("test message");
    expect(result).toBeUndefined();

    client.close();
  });

  test("unified API: subscriptions still work", async () => {
    const client = createZocketClient<AppRouter>(`ws://127.0.0.1:${port}`);

    const messages: string[] = [];
    client.on.message((msg) => {
      messages.push(msg);
    });

    await new Promise<void>((resolve) => {
      client.onOpen(resolve);
    });

    await client.trigger("hello via trigger");

    // Give it a moment to arrive
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(messages).toContain("hello via trigger");

    client.close();
  });
});
