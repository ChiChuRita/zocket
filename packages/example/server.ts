import { z } from "zod";
import { zocket, createBunServer } from "@zocket/core";

const PORT = Number(Bun.env.PORT ?? 3000);
const DEFAULT_ROOMS = ["lobby", "product", "ops"] as const;
const MAX_HISTORY = 40;

type Role = "admin" | "member";

type ClientInfo = {
  name: string;
  role: Role;
  connectedAt: number;
};

type ChatMessage = {
  id: string;
  roomId: string;
  user: string;
  role: Role;
  text: string;
  at: string;
  traceId: string;
};

type RoomSnapshot = {
  roomId: string;
  members: number;
  online: string[];
};

const defaultRoomSet = new Set<string>(DEFAULT_ROOMS);

const state = {
  clients: new Map<string, ClientInfo>(),
  rooms: new Map<string, Set<string>>(
    DEFAULT_ROOMS.map((roomId) => [roomId, new Set<string>()])
  ),
  messages: new Map<string, ChatMessage[]>(),
};

const ensureRoom = (roomId: string) => {
  if (!state.rooms.has(roomId)) {
    state.rooms.set(roomId, new Set());
  }
};

const rememberMessage = (message: ChatMessage) => {
  const history = state.messages.get(message.roomId) ?? [];
  history.push(message);
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
  state.messages.set(message.roomId, history);
};

const buildRoomSnapshot = (): RoomSnapshot[] => {
  return [...state.rooms.entries()].map(([roomId, members]) => {
    const online = [...members]
      .map((clientId) => state.clients.get(clientId)?.name)
      .filter((name): name is string => Boolean(name));
    return {
      roomId,
      members: members.size,
      online,
    };
  });
};

const zo = zocket.create({
  headers: z.object({
    user: z.string().min(1).default("guest"),
    role: z.enum(["admin", "member"]).default("member"),
  }),
  onConnect: (headers, clientId) => {
    const info: ClientInfo = {
      name: headers.user.trim().slice(0, 24),
      role: headers.role,
      connectedAt: Date.now(),
    };
    state.clients.set(clientId, info);
    return info;
  },
  onDisconnect: (ctx, clientId) => {
    state.clients.delete(clientId);

    for (const roomId of ctx.rooms) {
      const room = state.rooms.get(roomId);
      if (room) {
        room.delete(clientId);
        if (room.size === 0 && !defaultRoomSet.has(roomId)) {
          state.rooms.delete(roomId);
          state.messages.delete(roomId);
        }
      }
    }
  },
});

const withTrace = zo.message
  .use(() => ({
    traceId: crypto.randomUUID(),
    receivedAt: Date.now(),
  }))
  .use(({ ctx }) => ({
    userLabel: ctx.name,
  }));

const adminGate = zo.message.use(({ ctx }) => ({
  isAdmin: ctx.role === "admin",
}));

const appRouter = zo
  .router()
  .outgoing({
    system: {
      toast: z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        tone: z.enum(["info", "success", "warning", "danger"]),
      }),
    },
    presence: {
      joined: z.object({
        roomId: z.string(),
        user: z.string(),
        role: z.enum(["admin", "member"]),
        at: z.string(),
      }),
      left: z.object({
        roomId: z.string(),
        user: z.string(),
        role: z.enum(["admin", "member"]),
        at: z.string(),
      }),
    },
    chat: {
      message: z.object({
        id: z.string(),
        roomId: z.string(),
        user: z.string(),
        role: z.enum(["admin", "member"]),
        text: z.string(),
        at: z.string(),
        traceId: z.string(),
      }),
    },
    stats: {
      tick: z.object({
        at: z.string(),
        online: z.number(),
        rooms: z.array(
          z.object({
            roomId: z.string(),
            members: z.number(),
          })
        ),
      }),
    },
  })
  .incoming(({ send }) => ({
    rooms: {
      join: withTrace
        .input(z.object({ roomId: z.string().min(1) }))
        .handle(({ ctx, input }) => {
          ensureRoom(input.roomId);
          ctx.rooms.join(input.roomId);
          state.rooms.get(input.roomId)!.add(ctx.clientId);

          send.presence
            .joined({
              roomId: input.roomId,
              user: ctx.name,
              role: ctx.role,
              at: new Date().toISOString(),
            })
            .toRoom([input.roomId]);

          send.system
            .toast({
              id: crypto.randomUUID(),
              title: `Joined #${input.roomId}`,
              description: `Trace ${ctx.traceId} • ${ctx.userLabel}`,
              tone: "success",
            })
            .to([ctx.clientId]);
        }),
      leave: withTrace
        .input(z.object({ roomId: z.string().min(1) }))
        .handle(({ ctx, input }) => {
          const room = state.rooms.get(input.roomId);
          if (room) {
            room.delete(ctx.clientId);
            if (room.size === 0 && !defaultRoomSet.has(input.roomId)) {
              state.rooms.delete(input.roomId);
              state.messages.delete(input.roomId);
            }
          }

          send.presence
            .left({
              roomId: input.roomId,
              user: ctx.name,
              role: ctx.role,
              at: new Date().toISOString(),
            })
            .toRoom([input.roomId]);

          ctx.rooms.leave(input.roomId);
        }),
    },
    chat: {
      send: withTrace
        .input(
          z.object({
            roomId: z.string().min(1),
            text: z.string().min(1).max(200),
          })
        )
        .handle(({ ctx, input }) => {
          if (!ctx.rooms.has(input.roomId)) {
            send.system
              .toast({
                id: crypto.randomUUID(),
                title: "Room access denied",
                description: `Join #${input.roomId} before posting.`,
                tone: "warning",
              })
              .to([ctx.clientId]);
            return { ok: false as const };
          }

          const message: ChatMessage = {
            id: crypto.randomUUID(),
            roomId: input.roomId,
            user: ctx.name,
            role: ctx.role,
            text: input.text,
            at: new Date().toISOString(),
            traceId: ctx.traceId,
          };

          rememberMessage(message);

          send.chat.message(message).toRoom([input.roomId]);

          return { ok: true as const, id: message.id };
        }),
      history: zo.message
        .input(
          z.object({
            roomId: z.string().min(1),
            limit: z.number().min(1).max(50).default(30),
          })
        )
        .handle(({ input }) => {
          const history = state.messages.get(input.roomId) ?? [];
          return history.slice(-input.limit);
        }),
    },
    stats: {
      get: zo.message.input(z.object({})).handle(() => {
        return {
          now: new Date().toISOString(),
          online: state.clients.size,
          rooms: buildRoomSnapshot(),
        };
      }),
    },
    admin: {
      announce: adminGate
        .input(z.object({ message: z.string().min(1).max(200) }))
        .handle(({ ctx, input }) => {
          if (!ctx.isAdmin) {
            return { ok: false as const, reason: "forbidden" };
          }

          send.system
            .toast({
              id: crypto.randomUUID(),
              title: "Admin broadcast",
              description: input.message,
              tone: "info",
            })
            .broadcast();

          return { ok: true as const };
        }),
    },
  }));

export type AppRouter = typeof appRouter;

const handlers = createBunServer(appRouter, zo);

Bun.serve({
  port: PORT,
  fetch: handlers.fetch,
  websocket: handlers.websocket,
});

setInterval(() => {
  handlers.send.stats
    .tick({
      at: new Date().toISOString(),
      online: state.clients.size,
      rooms: buildRoomSnapshot().map((room) => ({
        roomId: room.roomId,
        members: room.members,
      })),
    })
    .broadcast();
}, 5000);

console.log(`Example server running on ws://localhost:${PORT}`);
