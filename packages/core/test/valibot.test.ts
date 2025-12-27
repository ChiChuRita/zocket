import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import * as v from "valibot";
import { zocket, createBunServer } from "../src/index";
import { createZocketClient } from "@zocket/client";

describe("Valibot validator integration", () => {
  let server: any;
  let port: number;

  const zo = zocket.create({
    headers: v.object({
      user: v.optional(v.string(), "guest"),
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
        onPong: v.object({
          reply: v.string(),
        }),
      },
    })
    .incoming(({ send }) => ({
      echo: {
        ping: zo.message
          .input(
            v.object({
              message: v.optional(v.string(), "ping"),
            })
          )
          .handle(({ ctx, input }) => {
            const reply = `pong: ${input.message}`;
            send.echo.onPong({ reply }).to([ctx.clientId]);
          }),
      },
    }));

  type ValibotRouter = typeof appRouter;

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

  test("client can send ping and receive pong with Valibot schemas", async () => {
    const client = createZocketClient<ValibotRouter>(`ws://127.0.0.1:${port}`, {
      headers: { user: "valibot-tester" },
      debug: false,
    });

    const pongPromise = new Promise<string>((resolve) => {
      client.on.echo.onPong((data) => {
        resolve(data.reply);
      });
    });

    await new Promise<void>((resolve) => {
      client.onOpen(() => {
        client.send.echo.ping({ message: "hello from valibot" });
        resolve();
      });
    });

    const result = await pongPromise;
    expect(result).toBe("pong: hello from valibot");

    client.close();
  });

  test("client can use default values from Valibot schema", async () => {
    const client = createZocketClient<ValibotRouter>(`ws://127.0.0.1:${port}`, {
      headers: { user: "valibot-default-tester" },
      debug: false,
    });

    const pongPromise = new Promise<string>((resolve) => {
      client.on.echo.onPong((data) => {
        resolve(data.reply);
      });
    });

    await new Promise<void>((resolve) => {
      client.onOpen(() => {
        client.send.echo.ping({});
        resolve();
      });
    });

    const result = await pongPromise;
    expect(result).toBe("pong: ping");

    client.close();
  });
});
