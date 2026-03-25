import { createApp } from "./app";
import type { ActorDef, AppDef } from "./types";

/**
 * Register actors for use with the distributed actor runtime.
 *
 * ```ts
 * export const registry = setup({ use: { counter, chat } });
 * ```
 *
 * This is the entrypoint for the docker-compose / distributed deployment model.
 * For standalone single-process usage, use `createApp()` + `serve()` instead.
 */
export function setup<
  const TActors extends Record<string, ActorDef<any, any, any>>,
>(config: { use: TActors }): AppDef<TActors> {
  return createApp({ actors: config.use });
}
