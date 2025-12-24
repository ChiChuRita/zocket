import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { zocket, createBunServer } from "../src/index";
import { createZocketClient } from "@zocket/client";

describe("Fluent API demonstration", () => {
  let server: any;
  let port: number;

  const zo = zocket.create({
    headers: z.object({
      userName: z.string().default("User"),
      userRole: z.enum(["admin", "moderator", "user"]).default("user"),
    }),
    onConnect: (headers, clientId) => {
      console.log(`✅ ${headers.userName} connected - ${clientId}`);
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
      return { isPrivileged: true as const, name: "John Doe" };
    }
    throw new Error("Forbidden");
  });

  const appRouter = zo
    .router()
    .outgoing({
      system: {
        onAnnouncement: z.object({
          message: z.string(),
          from: z.string(),
          timestamp: z.date(),
        }),
      },
      chat: {
        onPrivate: z.object({
          from: z.string(),
          message: z.string(),
          timestamp: z.date(),
        }),
        onRoom: z.object({
          roomId: z.string(),
          from: z.string(),
          message: z.string(),
          timestamp: z.date(),
        }),
      },
      notification: {
        onReceive: z.object({
          type: z.enum(["info", "warning", "error"]),
          message: z.string(),
          timestamp: z.date(),
        }),
      },
      connection: {
        onClientId: z.object({
          clientId: z.string(),
        }),
      },
    })
    .incoming(({ send }) => ({
      system: {
        announcement: protectedMessage
          .input(z.object({ message: z.string() }))
          .handle(({ ctx, input }) => {
            const userName = ctx.userName;
            console.log(
              `📢 [System] Announcement from ${userName}: "${input.message}"`
            );

            send.system
              .onAnnouncement({
                message: input.message,
                from: userName,
                timestamp: new Date(),
              })
              .broadcast();
          }),
      },

      chat: {
        private: zo.message
          .input(
            z.object({
              targetUserId: z.string(),
              message: z.string(),
            })
          )
          .handle(({ ctx, input }) => {
            const userName = ctx.userName;
            console.log(
              `📨 [Chat] Private message from ${userName} to ${input.targetUserId}: "${input.message}"`
            );

            send.chat
              .onPrivate({
                from: userName,
                message: input.message,
                timestamp: new Date(),
              })
              .to([input.targetUserId]);
          }),

        room: zo.message
          .input(
            z.object({
              roomId: z.string(),
              message: z.string(),
            })
          )
          .handle(({ ctx, input }) => {
            const userName = ctx.userName;
            console.log(
              `🏘️ [Room] Message from ${userName} in ${input.roomId}: "${input.message}"`
            );

            send.chat
              .onRoom({
                roomId: input.roomId,
                from: userName,
                message: input.message,
                timestamp: new Date(),
              })
              .toRoom([input.roomId]);
          }),
      },

      notification: {
        send: zo.message
          .input(
            z.object({
              type: z.enum(["info", "warning", "error"]),
              message: z.string(),
              targets: z.array(z.string()).optional(),
              rooms: z.array(z.string()).optional(),
              broadcast: z.boolean().optional(),
            })
          )
          .handle(({ ctx, input }) => {
            const userName = ctx.userName;
            const role = ctx.userRole;

            if (role !== "admin" && role !== "moderator") {
              console.log(
                `🚫 ${userName} tried to send notification but lacks permission`
              );
              return;
            }

            console.log(
              `🔔 [Notification] Sending ${input.type} notification: "${input.message}"`
            );

            const notification = {
              type: input.type,
              message: input.message,
              timestamp: new Date(),
            };

            if (input.broadcast) {
              send.notification.onReceive(notification).broadcast();
            } else if (input.targets?.length) {
              send.notification.onReceive(notification).to(input.targets);
            } else if (input.rooms?.length) {
              send.notification.onReceive(notification).toRoom(input.rooms);
            }
          }),
      },

      connection: {
        getClientId: zo.message.input(z.object({})).handle(({ ctx }) => {
          send.connection
            .onClientId({ clientId: ctx.clientId })
            .to([ctx.clientId]);
        }),
      },

      rooms: {
        join: zo.message
          .input(
            z.object({
              roomId: z.string(),
            })
          )
          .handle(({ ctx, input }) => {
            ctx.rooms.join(input.roomId);
          }),
      },
    }));

  type FluentRouter = typeof appRouter;

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
        console.log(
          `📥 [User Client] Received announcement: "${data.message}"`
        );
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
        console.log(
          `📥 [Bob Client] Received private message from ${data.from}: "${data.message}"`
        );
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
        console.log(
          `📥 [Bob Client] Received room message from ${data.from} in ${data.roomId}: "${data.message}"`
        );
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
        console.log(
          `📥 [User Client] Received notification: "${data.message}"`
        );
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
