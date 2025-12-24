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

const pingPongRouter = {
  test: {
    ping: zo.message.incoming({
      payload: z.object({
        message: z.string(),
        timestamp: z.number(),
      }),
    }),
    pong: zo.message.outgoing({
      payload: z.object({
        message: z.string(),
        timestamp: z.number(),
        serverTime: z.number(),
      }),
    }),
  },
};

export type PingPongRouter = typeof pingPongRouter;

const appRouter = zo.router(pingPongRouter, {
  test: {
    ping: ({ payload, ctx }) => {
      console.log(
        `📩 received ping from ${ctx.clientId}:`,
        JSON.stringify(payload)
      );
      const responsePayload = {
        message: payload.message,
        timestamp: payload.timestamp,
        serverTime: Date.now(),
      };
      console.log(
        `📤 sending pong to ${ctx.clientId}:`,
        JSON.stringify(responsePayload)
      );
      ctx.send.test.pong(responsePayload).to([ctx.clientId]);
    },
  },
});

export function createTestServer(port: number = 3333) {
  const handlers = createBunServer(appRouter, zo);

  const server = Bun.serve({
    fetch: handlers.fetch,
    websocket: handlers.websocket,
    port,
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
}
