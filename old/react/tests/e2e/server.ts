import { z } from "zod";
import { zocket, createBunServer } from "@zocket/core";

const zo = zocket.create({
  headers: z.object({
    clientName: z.string().default("test-client"),
  }),
  onConnect: (headers, clientId) => {
    console.log(`✅ ${headers.clientName} connected (${clientId})`);
    return { clientName: headers.clientName };
  },
  onDisconnect: (ctx, clientId) => {
    console.log(`❌ ${ctx.clientName} disconnected (${clientId})`);
  },
});

export const appRouter = zo
  .router()
  .outgoing({
    test: {
      pong: z.object({
        message: z.string(),
        timestamp: z.number(),
        serverTime: z.number(),
      }),
    },
  })
  .incoming(({ send }) => ({
    test: {
      ping: zo.message
        .input(
          z.object({
            message: z.string(),
            timestamp: z.number(),
          })
        )
        .handle(({ ctx, input }) => {
          console.log(
            `📩 received ping from ${ctx.clientId}:`,
            JSON.stringify(input)
          );
          const responsePayload = {
            message: input.message,
            timestamp: input.timestamp,
            serverTime: Date.now(),
          };
          console.log(
            `📤 sending pong to ${ctx.clientId}:`,
            JSON.stringify(responsePayload)
          );
          send.test.pong(responsePayload).to([ctx.clientId]);
        }),
    },
  }));

export type PingPongRouter = typeof appRouter;

export function createTestServer(port: number = 3333) {
  const handlers = createBunServer(appRouter, zo);

  const maxAttempts = port === 0 ? 20 : 1;
  let attempt = 0;
  let lastError: unknown;
  while (attempt < maxAttempts) {
    try {
      const candidatePort =
        port === 0
          ? Math.floor(Math.random() * (60_000 - 30_000 + 1)) + 30_000
          : port;

      const server = Bun.serve({
        fetch: handlers.fetch,
        websocket: handlers.websocket,
        port: candidatePort,
        hostname: "127.0.0.1",
      });

      console.log(`🧪 Test server running on ws://localhost:${server.port}`);

      return {
        server,
        url: `ws://localhost:${server.port}`,
        close: () => {
          server.stop();
          console.log(`🛑 Test server stopped`);
        },
      };
    } catch (err) {
      lastError = err;
      attempt++;
      if (port !== 0) {
        throw err;
      }
    }
  }

  throw lastError ?? new Error("Failed to start test server");
}
