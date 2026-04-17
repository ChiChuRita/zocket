// In a published app these imports would be:
// import { createClient } from "@zocket/client";
// import { actor, createApp } from "@zocket/core";
// import { serve } from "@zocket/server/bun";
//
// Inside this monorepo we import package source directly so the example runs
// without needing a separate package build step first.
import { createClient } from "../../packages/client/src/index";
import { actor, createApp } from "../../packages/core/src/index";
import { serve } from "../../packages/server/src/bun";
import { z } from "zod";

const Message = z.object({
  author: z.string(),
  text: z.string(),
  sentAt: z.number(),
});

const Room = actor({
  state: z.object({
    title: z.string().default("general"),
    members: z.array(z.string()).default([]),
    messages: z.array(Message).default([]),
  }),

  methods: {
    join: {
      input: z.object({ name: z.string() }),
      handler: ({ state, input, emit }) => {
        if (!state.members.includes(input.name)) {
          state.members.push(input.name);
          emit("memberJoined", { name: input.name });
        }

        return {
          memberCount: state.members.length,
          members: [...state.members],
        };
      },
    },

    sendMessage: {
      input: z.object({ author: z.string(), text: z.string() }),
      handler: ({ state, input, emit }) => {
        const message = {
          author: input.author,
          text: input.text,
          sentAt: Date.now(),
        };

        state.messages.push(message);
        emit("messageSent", message);

        return {
          messageCount: state.messages.length,
          latest: message,
        };
      },
    },

    summary: {
      handler: ({ state }) => ({
        title: state.title,
        memberCount: state.members.length,
        messageCount: state.messages.length,
      }),
    },
  },

  events: {
    memberJoined: z.object({ name: z.string() }),
    messageSent: Message,
  },
});

const app = createApp({
  actors: {
    room: Room,
  },
});

async function main() {
  const server = serve(app, { port: 0 });
  const url = `ws://127.0.0.1:${server.port}`;

  console.log(`server listening on ${url}`);

  const client = createClient<typeof app>({
    url,
    reconnect: true,
  });

  client.on("status", (status) => {
    console.log("[connection]", status);
  });

  try {
    await client.$ready;

    const general = client.room("general");

    const stopEvents = [
      general.on("memberJoined", (event) => {
        console.log("[event:memberJoined]", event);
      }),
      general.on("messageSent", (event) => {
        console.log("[event:messageSent]", event);
      }),
    ];

    const stopState = general.state.subscribe((state) => {
      console.log("[state]", state);
    });

    const joinResult = await general.join({ name: "alice" });
    console.log("[rpc:join]", joinResult);

    const messageResult = await general.sendMessage({
      author: "alice",
      text: "hello from zocket",
    });
    console.log("[rpc:sendMessage]", messageResult);

    const summary = await general.summary();
    console.log("[rpc:summary]", summary);

    stopState();
    for (const stop of stopEvents) stop();
  } finally {
    client.$close();
    server.stop(true);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
