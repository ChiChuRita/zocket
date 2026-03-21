import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { zocket, createBunServer } from "../src/index";
import { createZocketClient } from "@zocket/client";

describe("Simple ping-pong example", () => {
  let server: any;
  let port: number;
  let handlers: ReturnType<typeof createBunServer<any, any, SimpleRouter>>;

  const zo = zocket.create({
    headers: z.object({
      user: z.string().default("guest"),
    }),
    onConnect: (headers, clientId) => {
      return {
        user: headers.user,
      };
    },
    onDisconnect: (ctx, clientId) => {
      console.log(`❌ ${ctx.user} disconnected (${clientId})`);
    },
  });

  const appRouter = zo
    .router()
    .outgoing({
      echo: {
        pong: z.object({ reply: z.string() }),
      },
    })
    .incoming(({ send }) => ({
      echo: {
        ping: zo.message
          .input(z.object({ message: z.string().default("ping") }))
          .handle(({ ctx, input }) => {
            const reply = `pong: ${input.message}`;
            send.echo.pong({ reply }).to([ctx.clientId]);
          }),
      },
    }));

  type SimpleRouter = typeof appRouter;

  beforeAll(() => {
    handlers = createBunServer(appRouter, zo);
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

  test("client can send ping and receive pong", async () => {
    const client = createZocketClient<SimpleRouter>(`ws://127.0.0.1:${port}`, {
      headers: { user: "tester" },
      debug: false,
    });

    const pongPromise = new Promise<string>((resolve) => {
      client.on.echo.pong((data) => {
        resolve(data.reply);
      });
    });

    await new Promise<void>((resolve) => {
      client.onOpen(() => {
        client.echo.ping({ message: "ping" });
        resolve();

        client.echo.ping({ message: "ping" });
      });
    });

    const result = await pongPromise;
    expect(result).toBe("pong: ping");

    client.close();
  });

  test("server can push pong without receiving ping", async () => {
    const client = createZocketClient<SimpleRouter>(`ws://127.0.0.1:${port}`, {
      headers: { user: "server-push-tester" },
      debug: false,
    });

    const pongPromise = new Promise<string>((resolve) => {
      client.on.echo.pong((data) => {
        resolve(data.reply);
      });
    });

    await new Promise<void>((resolve) => {
      client.onOpen(() => {
        handlers.send.echo.pong({ reply: "server-push" }).broadcast();
        resolve();
      });
    });

    const result = await pongPromise;
    expect(result).toBe("server-push");

    client.close();
  });

  test("client can send custom message and receive pong", async () => {
    const client = createZocketClient<SimpleRouter>(`ws://127.0.0.1:${port}`, {
      headers: { user: "custom-tester" },
      debug: false,
    });

    const pongPromise = new Promise<string>((resolve) => {
      client.on.echo.pong((data) => {
        resolve(data.reply);
      });
    });

    await new Promise<void>((resolve) => {
      client.onOpen(() => {
        client.echo.ping({ message: "hello" });
        resolve();
      });
    });

    const result = await pongPromise;
    expect(result).toBe("pong: hello");

    client.close();
  });
});
