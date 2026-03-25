import { Elysia, t } from "elysia";

/**
 * Create the runtime HTTP API using Elysia.
 * The returned app type is exported so the CLI can use Eden Treaty.
 */
export function createApi(opts: {
  deploy: (code: string) => Promise<{ actorTypes: string[] }>;
  getStatus: () => { actorTypes: string[]; deployCount: number };
}) {
  return new Elysia()
    .get("/health", ({ set }) => {
      const status = opts.getStatus();
      return {
        ok: true as const,
        ...status,
      };
    }, {
      response: t.Object({
        ok: t.Literal(true),
        actorTypes: t.Array(t.String()),
        deployCount: t.Number(),
      }),
    })
    .post("/deploy", async ({ body }) => {
      if (!body.code || body.code.length === 0) {
        throw new Error("Empty bundle");
      }
      const result = await opts.deploy(body.code);
      const status = opts.getStatus();
      return {
        ok: true as const,
        actorTypes: result.actorTypes,
        deployCount: status.deployCount,
      };
    }, {
      body: t.Object({
        code: t.String(),
      }),
      response: t.Object({
        ok: t.Literal(true),
        actorTypes: t.Array(t.String()),
        deployCount: t.Number(),
      }),
    });
}

export type RuntimeApi = ReturnType<typeof createApi>;
