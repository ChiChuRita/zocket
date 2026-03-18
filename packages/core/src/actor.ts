import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ActorConfig,
  ActorDef,
  MethodContext,
  LifecycleHandler,
  InferSchema,
} from "./types";

/**
 * Define an actor.
 *
 * Generic parameters are inferred from the config object — callers never need
 * to specify them manually. The returned `ActorDef` carries the full type
 * information and the runtime config.
 */
export function actor<
  TState extends StandardSchemaV1,
  const TMethods extends Record<
    string,
    {
      input?: StandardSchemaV1;
      handler: (ctx: MethodContext<InferSchema<TState>, any>) => any;
    }
  >,
  const TEvents extends Record<string, StandardSchemaV1> = {},
>(
  config: {
    state: TState;
    methods: TMethods;
    events?: TEvents;
    onConnect?: LifecycleHandler<InferSchema<TState>>;
    onDisconnect?: LifecycleHandler<InferSchema<TState>>;
  },
): ActorDef<TState, TMethods, TEvents> {
  return {
    _tag: "ActorDef" as const,
    config: config as ActorConfig<TState, TMethods, TEvents>,
  };
}
