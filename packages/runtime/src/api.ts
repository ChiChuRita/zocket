import { Elysia, t } from "elysia";

/**
 * Create the runtime HTTP API using Elysia.
 * The returned app type is exported so the CLI can use Eden Treaty.
 */
export function createApi(opts: {
  getStatus: () => {
    deploymentId: string | null;
    actorTypes: string[];
    deployCount: number;
    workspaceId: string;
    projectId: string;
  };
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
        deploymentId: t.Union([t.String(), t.Null()]),
        actorTypes: t.Array(t.String()),
        deployCount: t.Number(),
        workspaceId: t.String(),
        projectId: t.String(),
      }),
    });
}

export type RuntimeApi = ReturnType<typeof createApi>;
