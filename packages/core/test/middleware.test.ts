import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { zocket, createBunServer } from "../src/index";
import { createZocketClient } from "@zocket/client";

describe("Middleware", () => {
  let server: any;
  let port: number;

  const zo = zocket.create({
    headers: z.object({
      role: z.enum(["admin", "user"]).default("user"),
    }),
    onConnect: (headers) => {
      return { role: headers.role };
    },
  });

  const withCtxFromMiddleware = zo.message
    .use(({ payload }) => {
      return { step1: `mw1-${payload.message}` as const };
    })
    .use(({ ctx }) => {
      return { step2: `mw2-${ctx.step1}` as const };
    });

  const adminOnly = zo.message.use(({ ctx }) => {
    if (ctx.role !== "admin") throw new Error("Forbidden");
    return { isAdmin: true as const };
  });

  const appRouter = zo
    .router()
    .outgoing({
      test: {
        onResult: z.object({
          step1: z.string(),
          step2: z.string(),
        }),
        onAdmin: z.object({
          ok: z.literal(true),
        }),
      },
    })
    .incoming(({ send }) => ({
      test: {
        compute: withCtxFromMiddleware
          .input(
            z.object({
              message: z.string().default("ping"),
            })
          )
          .handle(({ ctx }) => {
            send.test
              .onResult({ step1: ctx.step1, step2: ctx.step2 })
              .to([ctx.clientId]);
          }),

        adminOnly: adminOnly.input(z.object({})).handle(({ ctx }) => {
          // If middleware ran, ctx.isAdmin is available here
          if (!ctx.isAdmin) return;
          send.test.onAdmin({ ok: true }).to([ctx.clientId]);
        }),
      },
    }));

  type MiddlewareRouter = typeof appRouter;

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

  test("middlewares run in order and can extend ctx for the handler", async () => {
    const client = createZocketClient<MiddlewareRouter>(
      `ws://127.0.0.1:${port}`,
      {
        headers: { role: "user" },
        debug: false,
      }
    );

    const resultPromise = new Promise<{ step1: string; step2: string }>(
      (resolve) => {
        client.on.test.onResult((data) => resolve(data));
      }
    );

    await new Promise<void>((resolve) => {
      client.onOpen(() => {
        // send no message to ensure schema defaults are applied before middleware runs
        client.send.test.compute({});
        resolve();
      });
    });

    const result = await resultPromise;
    expect(result.step1).toBe("mw1-ping");
    expect(result.step2).toBe("mw2-mw1-ping");

    client.close();
  });

  test("middleware can block handler execution by throwing", async () => {
    const user = createZocketClient<MiddlewareRouter>(
      `ws://127.0.0.1:${port}`,
      {
        headers: { role: "user" },
        debug: false,
      }
    );

    const userAdminMsg = new Promise<unknown>((resolve) => {
      user.on.test.onAdmin((data) => resolve(data));
    });

    await new Promise<void>((resolve) => {
      user.onOpen(() => {
        user.send.test.adminOnly({});
        resolve();
      });
    });

    const userOutcome = await Promise.race([
      userAdminMsg.then(() => "message"),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 200)),
    ]);
    expect(userOutcome).toBe("timeout");
    user.close();

    const admin = createZocketClient<MiddlewareRouter>(
      `ws://127.0.0.1:${port}`,
      {
        headers: { role: "admin" },
        debug: false,
      }
    );

    const adminAdminMsg = new Promise<{ ok: true }>((resolve) => {
      admin.on.test.onAdmin((data) => resolve(data));
    });

    await new Promise<void>((resolve) => {
      admin.onOpen(() => {
        admin.send.test.adminOnly({});
        resolve();
      });
    });

    const adminResult = await adminAdminMsg;
    expect(adminResult.ok).toBe(true);

    admin.close();
  });
});
