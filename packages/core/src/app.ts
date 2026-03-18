import type { ActorDef, AppDef } from "./types";

/**
 * Bundle actor definitions into an application.
 *
 * ```ts
 * const app = createApp({ actors: { chat: ChatRoom, game: GameMatch } })
 * ```
 */
export function createApp<
  const TActors extends Record<string, ActorDef<any, any, any>>,
>(config: { actors: TActors }): AppDef<TActors> {
  return {
    _tag: "AppDef" as const,
    actors: config.actors,
  };
}
