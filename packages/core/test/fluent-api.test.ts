import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { zocket, createBunServer } from "../src/index";
import { createZocketClient } from "../src/client/client";

describe("Fluent API demonstration", () => {
  let server: any;
  let port: number;

  const zo = zocket.create({
    headers: z.object({
      userName: z.string().default("User"),
      userRole: z.enum(["admin", "moderator", "user"]).default("user"),
    }),
    onConnect: (headers, clientId) => {
      return {
        userName: headers.userName,
        userRole: headers.userRole,
      };
    },
    onDisconnect: (ctx, clientId) => {
      console.log(`❌ ${ctx.userName} disconnected - ${clientId}`);
    },
  });

  const protectedMessage = zo.message.use(({ ctx }) => {
    const role = ctx.userRole;
    if (role === "admin" || role === "moderator") {
      return { isPrivileged: true as const };
    }
    throw new Error("Forbidden");
  });

  const fluentRouter = {
    system: {
      announcement: protectedMessage.incoming({
        payload: z.object({ message: z.string() }),
      }),
      onAnnouncement: zo.message.outgoing({
        payload: z.object({
          message: z.string(),
          from: z.string(),
          timestamp: z.date(),
        }),
      }),
    },

    chat: {
      private: zo.message.incoming({
        payload: z.object({
          targetUserId: z.string(),
          message: z.string(),
        }),
      }),
      room: zo.message.incoming({
        payload: z.object({
          roomId: z.string(),
          message: z.string(),
        }),
      }),
      onPrivate: zo.message.outgoing({
        payload: z.object({
          from: z.string(),
          message: z.string(),
          timestamp: z.date(),
        }),
      }),
      onRoom: zo.message.outgoing({
        payload: z.object({
          roomId: z.string(),
          from: z.string(),
          message: z.string(),
          timestamp: z.date(),
        }),
      }),
    },

    notification: {
      send: zo.message.incoming({
        payload: z.object({
          type: z.enum(["info", "warning", "error"]),
          message: z.string(),
          targets: z.array(z.string()).optional(),
          rooms: z.array(z.string()).optional(),
          broadcast: z.boolean().optional(),
        }),
      }),
      onReceive: zo.message.outgoing({
        payload: z.object({
          type: z.enum(["info", "warning", "error"]),
          message: z.string(),
          timestamp: z.date(),
        }),
      }),
    },

    connection: {
      getClientId: zo.message.incoming({
        payload: z.object({}),
      }),
      onClientId: zo.message.outgoing({
        payload: z.object({
          clientId: z.string(),
        }),
      }),
    },

    rooms: {
      join: zo.message.incoming({
        payload: z.object({
          roomId: z.string(),
        }),
      }),
    },
  };

  type FluentRouter = typeof fluentRouter;

  const appRouter = zo.router(fluentRouter, {
    system: {
      announcement: ({ payload, ctx }) => {
        const userName = ctx.userName;

        ctx.send.system
          .onAnnouncement({
            message: payload.message,
            from: userName,
            timestamp: new Date(),
          })
          .broadcast();
      },
    },

    chat: {
      private: ({ payload, ctx }) => {
        const userName = ctx.userName;

        ctx.send.chat
          .onPrivate({
            from: userName,
            message: payload.message,
            timestamp: new Date(),
          })
          .to([payload.targetUserId]);
      },

      room: ({ payload, ctx }) => {
        const userName = ctx.userName;

        ctx.send.chat
          .onRoom({
            roomId: payload.roomId,
            from: userName,
            message: payload.message,
            timestamp: new Date(),
          })
          .toRoom([payload.roomId]);
      },
    },

    notification: {
      send: ({ payload, ctx }) => {
        const userName = ctx.userName;
        const role = ctx.userRole;

        if (role !== "admin" && role !== "moderator") {
          console.log(
            `🚫 ${userName} tried to send notification but lacks permission`
          );
          return;
        }

        const notification = {
          type: payload.type,
          message: payload.message,
          timestamp: new Date(),
        };

        if (payload.broadcast) {
          ctx.send.notification.onReceive(notification).broadcast();
        } else if (payload.targets?.length) {
          ctx.send.notification.onReceive(notification).to(payload.targets);
        } else if (payload.rooms?.length) {
          ctx.send.notification.onReceive(notification).toRoom(payload.rooms);
        }
      },
    },

    connection: {
      getClientId: ({ ctx }) => {
        ctx.send.connection
          .onClientId({ clientId: ctx.clientId })
          .to([ctx.clientId]);
      },
    },

    rooms: {
      join: ({ payload, ctx }) => {
        ctx.rooms.join(payload.roomId);
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

  test("admin can send system-wide announcements", async () => {
    const admin = createZocketClient<FluentRouter>(`ws://127.0.0.1:${port}`, {
      headers: { userName: "Admin", userRole: "admin" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const user = createZocketClient<FluentRouter>(`ws://127.0.0.1:${port}`, {
      headers: { userName: "User", userRole: "user" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const announcementPromise = new Promise<string>((resolve) => {
      user.on.system.onAnnouncement((data) => {
        resolve(data.message);
      });
    });

    await new Promise<void>((resolve) => {
      let adminReady = false;
      let userReady = false;

      admin.onOpen(() => {
        adminReady = true;
        if (adminReady && userReady) resolve();
      });

      user.onOpen(() => {
        userReady = true;
        if (adminReady && userReady) resolve();
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    admin.send.system.announcement({ message: "Welcome everyone!" });

    const message = await announcementPromise;
    expect(message).toBe("Welcome everyone!");

    admin.close();
    user.close();
  });

  test("clients can send private messages", async () => {
    const alice = createZocketClient<FluentRouter>(`ws://127.0.0.1:${port}`, {
      headers: { userName: "Alice", userRole: "user" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const bob = createZocketClient<FluentRouter>(`ws://127.0.0.1:${port}`, {
      headers: { userName: "Bob", userRole: "user" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const bobClientIdPromise = new Promise<string>((resolve) => {
      bob.on.connection.onClientId((data) => {
        resolve(data.clientId);
      });
    });

    const privateMessagePromise = new Promise<{
      from: string;
      message: string;
    }>((resolve) => {
      bob.on.chat.onPrivate((data) => {
        resolve({ from: data.from, message: data.message });
      });
    });

    await new Promise<void>((resolve) => {
      let aliceReady = false;
      let bobReady = false;

      alice.onOpen(() => {
        aliceReady = true;
        if (aliceReady && bobReady) resolve();
      });

      bob.onOpen(() => {
        bob.send.connection.getClientId({});
        bobReady = true;
        if (aliceReady && bobReady) resolve();
      });
    });

    const bobClientId = await bobClientIdPromise;
    await new Promise((resolve) => setTimeout(resolve, 100));
    alice.send.chat.private({
      targetUserId: bobClientId,
      message: "Hello Bob!",
    });

    const result = await privateMessagePromise;
    expect(result.from).toBe("Alice");
    expect(result.message).toBe("Hello Bob!");

    alice.close();
    bob.close();
  });

  test("clients can send room messages", async () => {
    const alice = createZocketClient<FluentRouter>(`ws://127.0.0.1:${port}`, {
      headers: { userName: "Alice", userRole: "user" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const bob = createZocketClient<FluentRouter>(`ws://127.0.0.1:${port}`, {
      headers: { userName: "Bob", userRole: "user" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const roomMessagePromise = new Promise<{
      roomId: string;
      from: string;
      message: string;
    }>((resolve) => {
      bob.on.chat.onRoom((data) => {
        resolve({
          roomId: data.roomId,
          from: data.from,
          message: data.message,
        });
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
    alice.send.chat.room({ roomId: "general", message: "Hello room!" });

    const result = await roomMessagePromise;
    expect(result.roomId).toBe("general");
    expect(result.from).toBe("Alice");
    expect(result.message).toBe("Hello room!");

    alice.close();
    bob.close();
  });

  test("admin can send broadcast notifications", async () => {
    const admin = createZocketClient<FluentRouter>(`ws://127.0.0.1:${port}`, {
      headers: { userName: "Admin", userRole: "admin" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const user = createZocketClient<FluentRouter>(`ws://127.0.0.1:${port}`, {
      headers: { userName: "User", userRole: "user" },
      maxReconnectionDelay: 1000,
      minReconnectionDelay: 100,
      debug: false,
    });

    const notificationPromise = new Promise<{
      type: string;
      message: string;
    }>((resolve) => {
      user.on.notification.onReceive((data) => {
        resolve({ type: data.type, message: data.message });
      });
    });

    await new Promise<void>((resolve) => {
      let adminReady = false;
      let userReady = false;

      admin.onOpen(() => {
        adminReady = true;
        if (adminReady && userReady) resolve();
      });

      user.onOpen(() => {
        userReady = true;
        if (adminReady && userReady) resolve();
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    admin.send.notification.send({
      type: "info",
      message: "System maintenance scheduled",
      broadcast: true,
    });

    const result = await notificationPromise;
    expect(result.type).toBe("info");
    expect(result.message).toBe("System maintenance scheduled");

    admin.close();
    user.close();
  });
});
