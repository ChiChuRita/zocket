import { CodeBlock } from "./code-block";

const code = `import { z } from "zod";
import { actor, createApp } from "@zocket/core";
import { validateToken } from "./auth";

const PrivateRoom = actor({
  state: z.object({
    messages: z.array(z.object({
      user: z.string(),
      text: z.string(),
    })).default([]),
  }),

  // Middleware runs before every method call
  middleware: async ({ headers, next }) => {
    const token = headers.get("authorization");
    const user = await validateToken(token);
    if (!user) throw new Error("Unauthorized");
    return next({ user });
  },

  methods: {
    send: {
      input: z.object({ text: z.string() }),
      handler: ({ state, input, ctx }) => {
        // ctx.user is fully typed from middleware
        state.messages.push({
          user: ctx.user.name,
          text: input.text,
        });
      },
    },
  },
});`;

export function MiddlewareExample() {
  return <CodeBlock title="middleware.ts" code={code} />;
}
