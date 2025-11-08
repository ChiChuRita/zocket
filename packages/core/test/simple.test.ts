import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { zocket, createBunServer } from "../src/index";
import { createZocketClient } from "../src/client/client";

describe("Simple ping-pong example", () => {
  let server: any;
  let port: number;

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

  const simpleRouter = {
    echo: {
      ping: zo.message.incoming({
        payload: z.object({ message: z.string().default("ping") }),
      }),
      onPong: zo.message.outgoing({
        payload: z.object({ reply: z.string() }),
      }),
    },
  };

  type SimpleRouter = typeof simpleRouter;

  const appRouter = zo.router(simpleRouter, {
    echo: {
      ping: ({ payload, ctx }) => {
        const reply = `pong: ${payload.message}`;
        ctx.send.echo.onPong({ reply }).to([ctx.clientId]);
      },
    },
  });

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

  test("client can send ping and receive pong", async () => {
    const client = createZocketClient<SimpleRouter>(`ws://127.0.0.1:${port}`, {
      headers: { user: "tester" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const pongPromise = new Promise<string>((resolve) => {
      client.on.echo.onPong((data) => {
        resolve(data.reply);
      });
    });

    await new Promise<void>((resolve) => {
      client.onOpen(() => {
        client.send.echo.ping({ message: "ping" });
        resolve();

        client.send.echo.ping({ message: "ping" });
      });
    });

    const result = await pongPromise;
    expect(result).toBe("pong: ping");

    client.close();
  });

  test("client can send custom message and receive pong", async () => {
    const client = createZocketClient<SimpleRouter>(`ws://127.0.0.1:${port}`, {
      headers: { user: "custom-tester" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const pongPromise = new Promise<string>((resolve) => {
      client.on.echo.onPong((data) => {
        resolve(data.reply);
      });
    });

    await new Promise<void>((resolve) => {
      client.onOpen(() => {
        client.send.echo.ping({ message: "hello" });
        resolve();
      });
    });

    const result = await pongPromise;
    expect(result).toBe("pong: hello");

    client.close();
  });
});
