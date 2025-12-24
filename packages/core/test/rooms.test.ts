import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { zocket, createBunServer } from "../src/index";
import { createZocketClient } from "@zocket/client";

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

  const appRouter = zo
    .router()
    .outgoing({
      rooms: {
        onJoin: z.object({
          roomId: z.string(),
          userName: z.string(),
        }),
        onLeave: z.object({
          roomId: z.string(),
          userName: z.string(),
        }),
        onMessage: z.object({
          roomId: z.string(),
          userName: z.string(),
          content: z.string(),
          timestamp: z.string(),
        }),
      },
    })
    .incoming(({ send }) => ({
      rooms: {
        join: zo.message
          .input(
            z.object({
              roomId: z.string(),
            })
          )
          .handle(({ ctx, input }) => {
            const userName = ctx["user-name"];
            ctx.rooms.join(input.roomId);

            send.rooms
              .onJoin({
                roomId: input.roomId,
                userName,
              })
              .toRoom([input.roomId]);
          }),
        leave: zo.message
          .input(
            z.object({
              roomId: z.string(),
            })
          )
          .handle(({ ctx, input }) => {
            const userName = ctx["user-name"];

            send.rooms
              .onLeave({
                roomId: input.roomId,
                userName,
              })
              .toRoom([input.roomId]);

            ctx.rooms.leave(input.roomId);
          }),
        message: zo.message
          .input(
            z.object({
              roomId: z.string(),
              content: z.string(),
            })
          )
          .handle(({ ctx, input }) => {
            const userName = ctx["user-name"];

            if (!ctx.rooms.has(input.roomId)) {
              console.log(
                `🚫 ${userName} tried to send message to ${input.roomId} without joining`
              );
              return;
            }

            send.rooms
              .onMessage({
                roomId: input.roomId,
                userName,
                content: input.content,
                timestamp: new Date().toISOString(),
              })
              .toRoom([input.roomId]);
          }),
      },
    }));

  type ChatRouter = typeof appRouter;

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
