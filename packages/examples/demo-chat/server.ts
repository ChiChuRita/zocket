import { z } from "zod";
import { zocket, createBunServer } from "@zocket/core";

type RoomState = {
  members: Set<string>;
  messages: Message[];
  typing: Map<string, NodeJS.Timeout>;
};

type Message = {
  id: string;
  username: string;
  content: string;
  timestamp: Date;
};

type DMConversation = {
  messages: Message[];
  participants: Set<string>;
};

const rooms = new Map<string, RoomState>();
const usernames = new Map<string, string>();
const clientIds = new Map<string, string>();
const dmConversations = new Map<string, DMConversation>();
const onlineUsers = new Map<
  string,
  { username: string; status: "online" | "away" }
>();

const DEFAULT_ROOMS = ["general", "random", "tech"];
DEFAULT_ROOMS.forEach((roomId) => {
  rooms.set(roomId, {
    members: new Set(),
    messages: [],
    typing: new Map(),
  });
});

function getDMKey(user1: string, user2: string): string {
  return [user1, user2].sort().join(":");
}

const zo = zocket.create({
  headers: z.object({
    username: z.string().default("Anonymous"),
  }),
  onConnect: (headers, clientId) => {
    const username = headers.username;
    usernames.set(clientId, username);
    clientIds.set(username, clientId);
    onlineUsers.set(username, { username, status: "online" });

    console.log(`✅ ${username} connected (${clientId})`);
    return { username };
  },
  onDisconnect: (_ctx, clientId) => {
    const username = usernames.get(clientId);
    if (username) {
      onlineUsers.delete(username);
      clientIds.delete(username);
      usernames.delete(clientId);

      rooms.forEach((room) => {
        if (room.members.has(clientId)) {
          room.members.delete(clientId);
          if (room.typing.has(clientId)) {
            clearTimeout(room.typing.get(clientId)!);
            room.typing.delete(clientId);
          }
        }
      });

      console.log(`❌ ${username} disconnected (${clientId})`);
    }
  },
});

const chatRouter = {
  rooms: {
    list: zo.message.incoming({
      payload: z.object({}),
    }),
    join: zo.message.incoming({
      payload: z.object({ roomId: z.string() }),
    }),
    leave: zo.message.incoming({
      payload: z.object({ roomId: z.string() }),
    }),
    message: zo.message.incoming({
      payload: z.object({
        roomId: z.string(),
        content: z.string(),
      }),
    }),
    onList: zo.message.outgoing({
      payload: z.object({
        rooms: z.array(
          z.object({
            id: z.string(),
            memberCount: z.number(),
          })
        ),
      }),
    }),
    onJoin: zo.message.outgoing({
      payload: z.object({
        roomId: z.string(),
        username: z.string(),
        messages: z.array(
          z.object({
            id: z.string(),
            username: z.string(),
            content: z.string(),
            timestamp: z.date(),
          })
        ),
      }),
    }),
    onLeave: zo.message.outgoing({
      payload: z.object({
        roomId: z.string(),
        username: z.string(),
      }),
    }),
    onMessage: zo.message.outgoing({
      payload: z.object({
        roomId: z.string(),
        id: z.string(),
        username: z.string(),
        content: z.string(),
        timestamp: z.date(),
      }),
    }),
    onUserJoined: zo.message.outgoing({
      payload: z.object({
        roomId: z.string(),
        username: z.string(),
      }),
    }),
    onUserLeft: zo.message.outgoing({
      payload: z.object({
        roomId: z.string(),
        username: z.string(),
      }),
    }),
  },
  dm: {
    send: zo.message.incoming({
      payload: z.object({
        toUsername: z.string(),
        content: z.string(),
      }),
    }),
    list: zo.message.incoming({
      payload: z.object({}),
    }),
    onMessage: zo.message.outgoing({
      payload: z.object({
        id: z.string(),
        fromUsername: z.string(),
        toUsername: z.string(),
        content: z.string(),
        timestamp: z.date(),
      }),
    }),
    onList: zo.message.outgoing({
      payload: z.object({
        conversations: z.array(
          z.object({
            username: z.string(),
            messages: z.array(
              z.object({
                id: z.string(),
                username: z.string(),
                content: z.string(),
                timestamp: z.date(),
              })
            ),
          })
        ),
      }),
    }),
  },
  typing: {
    start: zo.message.incoming({
      payload: z.object({
        roomId: z.string().optional(),
        dmUsername: z.string().optional(),
      }),
    }),
    stop: zo.message.incoming({
      payload: z.object({
        roomId: z.string().optional(),
        dmUsername: z.string().optional(),
      }),
    }),
    onTyping: zo.message.outgoing({
      payload: z.object({
        username: z.string(),
        roomId: z.string().optional(),
        dmUsername: z.string().optional(),
        isTyping: z.boolean(),
      }),
    }),
  },
  users: {
    list: zo.message.incoming({
      payload: z.object({}),
    }),
    updateStatus: zo.message.incoming({
      payload: z.object({
        status: z.enum(["online", "away"]),
      }),
    }),
    onList: zo.message.outgoing({
      payload: z.object({
        users: z.array(
          z.object({
            username: z.string(),
            status: z.enum(["online", "away"]),
          })
        ),
      }),
    }),
    onUserStatusChanged: zo.message.outgoing({
      payload: z.object({
        username: z.string(),
        status: z.enum(["online", "away", "offline"]),
      }),
    }),
  },
};

export type ChatRouter = typeof chatRouter;

const appRouter = zo.router(chatRouter, {
  rooms: {
    list: ({ ctx }) => {
      const roomsList = Array.from(rooms.entries()).map(([id, state]) => ({
        id,
        memberCount: state.members.size,
      }));

      ctx.send.rooms.onList({ rooms: roomsList }).to([ctx.clientId]);
    },
    join: ({ payload, ctx }) => {
      const { roomId } = payload;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          members: new Set(),
          messages: [],
          typing: new Map(),
        });
      }

      const room = rooms.get(roomId)!;
      room.members.add(ctx.clientId);
      ctx.rooms.join(roomId);

      ctx.send.rooms
        .onJoin({
          roomId,
          username: ctx.username,
          messages: room.messages.slice(-50),
        })
        .to([ctx.clientId]);

      ctx.send.rooms
        .onUserJoined({
          roomId,
          username: ctx.username,
        })
        .toRoom([roomId]);
    },
    leave: ({ payload, ctx }) => {
      const { roomId } = payload;
      const room = rooms.get(roomId);

      if (room) {
        room.members.delete(ctx.clientId);
        if (room.typing.has(ctx.clientId)) {
          clearTimeout(room.typing.get(ctx.clientId)!);
          room.typing.delete(ctx.clientId);
        }
      }

      ctx.send.rooms
        .onUserLeft({
          roomId,
          username: ctx.username,
        })
        .toRoom([roomId]);

      ctx.rooms.leave(roomId);
    },
    message: ({ payload, ctx }) => {
      const { roomId, content } = payload;
      const room = rooms.get(roomId);

      if (!room || !ctx.rooms.has(roomId)) {
        return;
      }

      const message: Message = {
        id: Math.random().toString(36).substring(2, 15),
        username: ctx.username,
        content,
        timestamp: new Date(),
      };

      room.messages.push(message);
      if (room.messages.length > 100) {
        room.messages.shift();
      }

      ctx.send.rooms
        .onMessage({
          roomId,
          ...message,
        })
        .toRoom([roomId]);
    },
  },
  dm: {
    send: ({ payload, ctx }) => {
      const { toUsername, content } = payload;
      const fromUsername = ctx.username;
      const targetClientId = clientIds.get(toUsername);

      if (!targetClientId) {
        return;
      }

      const dmKey = getDMKey(fromUsername, toUsername);
      if (!dmConversations.has(dmKey)) {
        dmConversations.set(dmKey, {
          messages: [],
          participants: new Set([fromUsername, toUsername]),
        });
      }

      const conversation = dmConversations.get(dmKey)!;
      const message: Message = {
        id: Math.random().toString(36).substring(2, 15),
        username: fromUsername,
        content,
        timestamp: new Date(),
      };

      conversation.messages.push(message);
      if (conversation.messages.length > 100) {
        conversation.messages.shift();
      }

      ctx.send.dm
        .onMessage({
          id: message.id,
          fromUsername,
          toUsername,
          content,
          timestamp: message.timestamp,
        })
        .to([ctx.clientId, targetClientId]);
    },
    list: ({ ctx }) => {
      const username = ctx.username;
      const userConversations: Array<{
        username: string;
        messages: Message[];
      }> = [];

      dmConversations.forEach((conversation, key) => {
        if (conversation.participants.has(username)) {
          const otherUser = key.split(":").find((u) => u !== username);
          if (otherUser) {
            userConversations.push({
              username: otherUser,
              messages: conversation.messages.slice(-50),
            });
          }
        }
      });

      ctx.send.dm
        .onList({
          conversations: userConversations,
        })
        .to([ctx.clientId]);
    },
  },
  typing: {
    start: ({ payload, ctx }) => {
      const { roomId, dmUsername } = payload;

      if (roomId) {
        const room = rooms.get(roomId);
        if (room && ctx.rooms.has(roomId)) {
          if (room.typing.has(ctx.clientId)) {
            clearTimeout(room.typing.get(ctx.clientId)!);
          }

          const timeout = setTimeout(() => {
            room.typing.delete(ctx.clientId);
            ctx.send.typing
              .onTyping({
                username: ctx.username,
                roomId,
                isTyping: false,
              })
              .toRoom([roomId]);
          }, 3000);

          room.typing.set(ctx.clientId, timeout);

          ctx.send.typing
            .onTyping({
              username: ctx.username,
              roomId,
              isTyping: true,
            })
            .toRoom([roomId]);
        }
      } else if (dmUsername) {
        const targetClientId = clientIds.get(dmUsername);
        if (targetClientId) {
          ctx.send.typing
            .onTyping({
              username: ctx.username,
              dmUsername,
              isTyping: true,
            })
            .to([targetClientId]);
        }
      }
    },
    stop: ({ payload, ctx }) => {
      const { roomId, dmUsername } = payload;

      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.typing.has(ctx.clientId)) {
          clearTimeout(room.typing.get(ctx.clientId)!);
          room.typing.delete(ctx.clientId);

          ctx.send.typing
            .onTyping({
              username: ctx.username,
              roomId,
              isTyping: false,
            })
            .toRoom([roomId]);
        }
      } else if (dmUsername) {
        const targetClientId = clientIds.get(dmUsername);
        if (targetClientId) {
          ctx.send.typing
            .onTyping({
              username: ctx.username,
              dmUsername,
              isTyping: false,
            })
            .to([targetClientId]);
        }
      }
    },
  },
  users: {
    list: ({ ctx }) => {
      const usersList = Array.from(onlineUsers.values());
      ctx.send.users.onList({ users: usersList }).to([ctx.clientId]);

      const allClients = Array.from(usernames.keys());
      ctx.send.users
        .onUserStatusChanged({
          username: ctx.username,
          status: "online",
        })
        .to(allClients);
    },
    updateStatus: ({ payload, ctx }) => {
      const user = onlineUsers.get(ctx.username);
      if (user) {
        user.status = payload.status;

        const allClients = Array.from(usernames.keys());
        ctx.send.users
          .onUserStatusChanged({
            username: ctx.username,
            status: payload.status,
          })
          .to(allClients);
      }
    },
  },
});

const handlers = createBunServer(appRouter, zo);

const server = Bun.serve({
  fetch: handlers.fetch,
  websocket: handlers.websocket,
  port: 3001,
  hostname: "127.0.0.1",
});

console.log(`🚀 Chat server running on ws://localhost:${server.port}`);
