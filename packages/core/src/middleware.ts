import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ActorConfig,
  ActorDef,
  MethodContext,
  LifecycleHandler,
  InferSchema,
} from "./types";

// ---------------------------------------------------------------------------
// Middleware types
// ---------------------------------------------------------------------------

/** Arguments passed to each middleware function */
export interface MiddlewareArgs<TCtx> {
  ctx: TCtx;
  connectionId: string;
  actor: string;
  actorId: string;
  method: string;
}

/** A middleware function that receives context and returns additional context */
export type MiddlewareFn<TCtx, TAdded extends Record<string, unknown>> = (
  args: MiddlewareArgs<TCtx>,
) => TAdded | Promise<TAdded>;

// ---------------------------------------------------------------------------
// MiddlewareBuilder
// ---------------------------------------------------------------------------

export class MiddlewareBuilder<TCtx extends Record<string, unknown>> {
  /** @internal */
  readonly _middlewares: MiddlewareFn<any, any>[];

  constructor(middlewares: MiddlewareFn<any, any>[] = []) {
    this._middlewares = middlewares;
  }

  /**
   * Append a middleware function to the chain.
   * The returned builder's `TCtx` is the intersection of the current context
   * and the additional context returned by `fn`.
   */
  use<TAdded extends Record<string, unknown>>(
    fn: MiddlewareFn<TCtx, TAdded>,
  ): MiddlewareBuilder<TCtx & TAdded> {
    return new MiddlewareBuilder<TCtx & TAdded>([...this._middlewares, fn]);
  }

  /**
   * Create an actor definition with the middleware chain attached.
   * Handlers receive `ctx: TCtx` with all accumulated middleware context.
   */
  actor<
    TState extends StandardSchemaV1,
    const TMethods extends Record<
      string,
      {
        input?: StandardSchemaV1;
        handler: (
          ctx: MethodContext<InferSchema<TState>, any, Record<string, StandardSchemaV1>, TCtx>,
        ) => any;
      }
    >,
    const TEvents extends Record<string, StandardSchemaV1> = {},
  >(config: {
    state: TState;
    methods: TMethods;
    events?: TEvents;
    onConnect?: LifecycleHandler<InferSchema<TState>>;
    onDisconnect?: LifecycleHandler<InferSchema<TState>>;
  }): ActorDef<TState, TMethods, TEvents> {
    return {
      _tag: "ActorDef" as const,
      config: {
        ...config,
        _middlewares: this._middlewares,
      } as ActorConfig<TState, TMethods, TEvents>,
    };
  }
}

/**
 * Create a new middleware builder.
 *
 * ```ts
 * const authed = middleware()
 *   .use(async ({ connectionId }) => {
 *     const user = await getUser(connectionId)
 *     if (!user) throw new Error('Unauthorized')
 *     return { userId: user.id }
 *   })
 *
 * const MyActor = authed.actor({ ... })
 * ```
 */
export function middleware(): MiddlewareBuilder<{}> {
  return new MiddlewareBuilder();
}
