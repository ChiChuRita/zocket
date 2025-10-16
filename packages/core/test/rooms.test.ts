import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { zocket, createBunServer } from "../src/index";
import { createZocketClient } from "../src/client/client";

describe("Multi-client room functionality", () => {
  let server: any;
  let port: number;

  const zo = zocket.create({
    headers: z.object({
      "user-name": z.string().default("Anonymous"),
    }),
    onConnect: (headers, clientId) => {
      return {
        "user-name": headers["user-name"],
      };
    },
    onDisconnect: (ctx, clientId) => {
      const rooms = [...ctx.rooms].join(", ") || "none";
      console.log(
        `❌ ${ctx["user-name"]} (${clientId}) disconnected from rooms: ${rooms}`
      );
    },
  });

  const chatRouter = {
    rooms: {
      join: zo.message.incoming({
        payload: z.object({
          roomId: z.string(),
        }),
      }),
      leave: zo.message.incoming({
        payload: z.object({
          roomId: z.string(),
        }),
      }),
      message: zo.message.incoming({
        payload: z.object({
          roomId: z.string(),
          content: z.string(),
        }),
      }),
      onJoin: zo.message.outgoing({
        payload: z.object({
          roomId: z.string(),
          userName: z.string(),
        }),
      }),
      onLeave: zo.message.outgoing({
        payload: z.object({
          roomId: z.string(),
          userName: z.string(),
        }),
      }),
      onMessage: zo.message.outgoing({
        payload: z.object({
          roomId: z.string(),
          userName: z.string(),
          content: z.string(),
          timestamp: z.date(),
        }),
      }),
    },
  };

  type ChatRouter = typeof chatRouter;

  const appRouter = zo.router(chatRouter, {
    rooms: {
      join: ({ payload, ctx }) => {
        const userName = ctx["user-name"];
        ctx.rooms.join(payload.roomId);

        ctx.send.rooms
          .onJoin({
            roomId: payload.roomId,
            userName,
          })
          .toRoom([payload.roomId]);
      },
      leave: ({ payload, ctx }) => {
        const userName = ctx["user-name"];

        ctx.send.rooms
          .onLeave({
            roomId: payload.roomId,
            userName,
          })
          .toRoom([payload.roomId]);

        ctx.rooms.leave(payload.roomId);
      },
      message: ({ payload, ctx }) => {
        const userName = ctx["user-name"];

        if (!ctx.rooms.has(payload.roomId)) {
          console.log(
            `🚫 ${userName} tried to send message to ${payload.roomId} without joining`
          );
          return;
        }

        ctx.send.rooms
          .onMessage({
            roomId: payload.roomId,
            userName,
            content: payload.content,
            timestamp: new Date(),
          })
          .toRoom([payload.roomId]);
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

  test("clients can join rooms and receive join notifications", async () => {
    const alice = createZocketClient<ChatRouter>(`ws://127.0.0.1:${port}`, {
      headers: { "user-name": "Alice" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const bob = createZocketClient<ChatRouter>(`ws://127.0.0.1:${port}`, {
      headers: { "user-name": "Bob" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const bobJoinPromise = new Promise<{ roomId: string; userName: string }>(
      (resolve) => {
        alice.on.rooms.onJoin((data) => {
          if (data.userName === "Bob") {
            resolve(data);
          }
        });
      }
    );

    await new Promise<void>((resolve) => {
      let aliceReady = false;
      let bobReady = false;

      alice.onOpen(() => {
        alice.send.rooms.join({ roomId: "general" });
        aliceReady = true;
        if (aliceReady && bobReady) resolve();
      });

      bob.onOpen(() => {
        bobReady = true;
        if (aliceReady && bobReady) resolve();
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    bob.send.rooms.join({ roomId: "general" });

    const joinData = await bobJoinPromise;
    expect(joinData.roomId).toBe("general");
    expect(joinData.userName).toBe("Bob");

    alice.close();
    bob.close();
  });

  test("clients receive messages only in rooms they joined", async () => {
    const alice = createZocketClient<ChatRouter>(`ws://127.0.0.1:${port}`, {
      headers: { "user-name": "Alice" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const bob = createZocketClient<ChatRouter>(`ws://127.0.0.1:${port}`, {
      headers: { "user-name": "Bob" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const messagePromise = new Promise<string>((resolve) => {
      alice.on.rooms.onMessage((data) => {
        resolve(data.content);
      });
    });

    await new Promise<void>((resolve) => {
      let aliceReady = false;
      let bobReady = false;

      alice.onOpen(() => {
        alice.send.rooms.join({ roomId: "general" });
        aliceReady = true;
        if (aliceReady && bobReady) resolve();
      });

      bob.onOpen(() => {
        bob.send.rooms.join({ roomId: "general" });
        bobReady = true;
        if (aliceReady && bobReady) resolve();
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    bob.send.rooms.message({ roomId: "general", content: "Hello Alice!" });

    const message = await messagePromise;
    expect(message).toBe("Hello Alice!");

    alice.close();
    bob.close();
  });

  test("clients can leave rooms and receive leave notifications", async () => {
    const alice = createZocketClient<ChatRouter>(`ws://127.0.0.1:${port}`, {
      headers: { "user-name": "Alice" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const bob = createZocketClient<ChatRouter>(`ws://127.0.0.1:${port}`, {
      headers: { "user-name": "Bob" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const leavePromise = new Promise<{ roomId: string; userName: string }>(
      (resolve) => {
        alice.on.rooms.onLeave((data) => {
          if (data.userName === "Bob") {
            resolve(data);
          }
        });
      }
    );

    await new Promise<void>((resolve) => {
      let aliceReady = false;
      let bobReady = false;

      alice.onOpen(() => {
        alice.send.rooms.join({ roomId: "general" });
        aliceReady = true;
        if (aliceReady && bobReady) resolve();
      });

      bob.onOpen(() => {
        bob.send.rooms.join({ roomId: "general" });
        bobReady = true;
        if (aliceReady && bobReady) resolve();
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    bob.send.rooms.leave({ roomId: "general" });

    const leaveData = await leavePromise;
    expect(leaveData.roomId).toBe("general");
    expect(leaveData.userName).toBe("Bob");

    alice.close();
    bob.close();
  });
});
