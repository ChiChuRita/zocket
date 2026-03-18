import type { StandardSchemaV1 } from "@standard-schema/spec";

// ---------------------------------------------------------------------------
// Schema inference
// ---------------------------------------------------------------------------

/** Extract the output type from any Standard Schema */
export type InferSchema<T extends StandardSchemaV1> =
  StandardSchemaV1.InferOutput<T>;

// ---------------------------------------------------------------------------
// Method definitions
// ---------------------------------------------------------------------------

/** A single method definition within an actor */
export interface MethodDef<
  TInput extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
  TResult = unknown,
> {
  input?: TInput;
  handler: MethodHandler<any, TInput, TResult>;
}

/** The handler function signature that method implementations must satisfy */
export type MethodHandler<
  TState,
  TInput extends StandardSchemaV1 | undefined,
  TResult,
  TCtx extends Record<string, unknown> = {},
  TEvents extends Record<string, any> = Record<string, StandardSchemaV1>,
> = (ctx: MethodContext<TState, TInput, TEvents, TCtx>) => TResult | Promise<TResult>;

/** Context passed to a method handler at runtime */
export interface MethodContext<
  TState,
  TInput extends StandardSchemaV1 | undefined,
  TEvents extends Record<string, any> = Record<string, StandardSchemaV1>,
  TCtx extends Record<string, unknown> = {},
> {
  state: TState;
  input: TInput extends StandardSchemaV1 ? InferSchema<TInput> : undefined;
  emit: TypedEmitFn<TEvents>;
  /** Opaque identifier for the connection that invoked this method (server-side only). */
  connectionId: string;
  /** Middleware context, always present. Defaults to an empty object. */
  ctx: TCtx;
}

/** A record of method definitions keyed by name */
export type MethodDefs = Record<string, MethodDef<any, any>>;

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

/** Events are schemas keyed by event name */
export type EventDefs = Record<string, StandardSchemaV1>;

/**
 * Typed emit function — constrains event names and payload types to declared events.
 *
 * Already used internally by `MethodContext`. If you want **explicit** type-checking
 * on `emit` inside a handler, destructure and annotate the emit parameter:
 *
 * ```ts
 * import type { TypedEmitFn } from "@zocket/core";
 *
 * const events = { message: MessageSchema };
 *
 * const MyActor = actor({
 *   state: MyState,
 *   events,
 *   methods: {
 *     send: {
 *       input: SendInput,
 *       handler: ({ state, input, emit }: {
 *         state: InferSchema<typeof MyState>;
 *         input: InferSchema<typeof SendInput>;
 *         emit: TypedEmitFn<typeof events>;
 *       }) => {
 *         emit("message", input); // fully typed
 *       },
 *     },
 *   },
 * });
 * ```
 *
 * In most cases you don't need this — `emit` payloads are validated at runtime
 * against the event schemas regardless of compile-time types.
 */
export type TypedEmitFn<TEvents extends Record<string, any>> = <
  K extends string & keyof TEvents,
>(
  event: K,
  payload: TEvents[K] extends StandardSchemaV1
    ? InferSchema<TEvents[K]>
    : unknown,
) => void;

/** Untyped emit function for generic / runtime contexts */
export type EmitFn = (event: string, payload: unknown) => void;

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

/** Context passed to onConnect / onDisconnect lifecycle hooks */
export interface LifecycleContext<TState> {
  state: TState;
  /** Opaque connection identifier — stable for the lifetime of a WebSocket. */
  connectionId: string;
  emit: EmitFn;
}

/** A lifecycle hook that can mutate state */
export type LifecycleHandler<TState> = (
  ctx: LifecycleContext<TState>,
) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Actor definition
// ---------------------------------------------------------------------------

/** The config object passed to `actor()` */
export interface ActorConfig<
  TState extends StandardSchemaV1 = StandardSchemaV1,
  TMethods extends Record<string, any> = MethodDefs,
  TEvents extends Record<string, any> = EventDefs,
> {
  state: TState;
  methods: TMethods;
  events?: TEvents;
  /** Called when a client first subscribes to this actor instance. */
  onConnect?: LifecycleHandler<InferSchema<TState>>;
  /** Called when a client's connection to this actor instance closes. */
  onDisconnect?: LifecycleHandler<InferSchema<TState>>;
  /** @internal Middleware chain attached via MiddlewareBuilder.actor() */
  _middlewares?: Array<(args: any) => any>;
}

/** Branded actor definition returned by `actor()` */
export interface ActorDef<
  TState extends StandardSchemaV1 = StandardSchemaV1,
  TMethods extends Record<string, any> = MethodDefs,
  TEvents extends Record<string, any> = EventDefs,
> {
  readonly _tag: "ActorDef";
  readonly config: ActorConfig<TState, TMethods, TEvents>;
}

// ---------------------------------------------------------------------------
// App definition
// ---------------------------------------------------------------------------

/** Config passed to `createApp()` */
export interface AppConfig<
  TActors extends Record<string, ActorDef<any, any, any>> = Record<
    string,
    ActorDef<any, any, any>
  >,
> {
  actors: TActors;
}

/** Branded app definition returned by `createApp()` */
export interface AppDef<
  TActors extends Record<string, ActorDef<any, any, any>> = Record<
    string,
    ActorDef<any, any, any>
  >,
> {
  readonly _tag: "AppDef";
  readonly actors: TActors;
}

// ---------------------------------------------------------------------------
// Type inference utilities (used by client / react packages)
// ---------------------------------------------------------------------------

/** Extract state type from an ActorDef */
export type InferState<T extends ActorDef<any, any, any>> =
  T extends ActorDef<infer S, any, any> ? InferSchema<S> : never;

/** Map method defs to callable signatures: name → (input) => Promise<result> */
export type InferMethods<T extends ActorDef<any, any, any>> =
  T extends ActorDef<any, infer M, any>
    ? {
        [K in keyof M]: M[K] extends {
          input: infer I;
          handler: (...args: any[]) => infer R;
        }
          ? I extends StandardSchemaV1
            ? (input: InferSchema<I>) => Promise<Awaited<R>>
            : () => Promise<Awaited<R>>
          : M[K] extends { handler: (...args: any[]) => infer R }
            ? () => Promise<Awaited<R>>
            : never;
      }
    : never;

/** Map event defs to callback signatures: name → (payload) => void */
export type InferEvents<T extends ActorDef<any, any, any>> =
  T extends ActorDef<any, any, infer E>
    ? {
        [K in keyof E]: E[K] extends StandardSchemaV1
          ? (payload: InferSchema<E[K]>) => void
          : never;
      }
    : never;

/** Unsubscribe function returned by .on() and .state.subscribe() */
export type Unsubscribe = () => void;

/** Extract the payload type from an event callback */
export type EventPayload<
  T extends ActorDef<any, any, any>,
  K extends keyof InferEvents<T>,
> = InferEvents<T>[K] extends (payload: infer P) => void ? P : never;

/** Client-facing typed handle for an actor instance */
export interface ActorHandleMeta {
  name: string;
  id: string;
  dispose: () => void;
}

export type ActorHandle<T extends ActorDef<any, any, any>> = InferMethods<T> & {
  on: <K extends keyof InferEvents<T>>(
    event: K,
    callback: InferEvents<T>[K],
  ) => Unsubscribe;
  state: {
    subscribe: (listener: (state: InferState<T>) => void) => Unsubscribe;
    getSnapshot: () => InferState<T> | undefined;
  };
  meta: ActorHandleMeta;
  /** @deprecated Use `meta.name`. */
  $actorName: string;
  /** @deprecated Use `meta.id`. */
  $actorId: string;
  /** @deprecated Use `meta.dispose()`. */
  $dispose: () => void;
};

/** Map an AppDef to the client's top-level API shape */
export type ClientApi<T extends AppDef<any>> = T extends AppDef<infer TActors>
  ? {
      [K in keyof TActors]: (id: string) => ActorHandle<TActors[K]>;
    }
  : never;

// ---------------------------------------------------------------------------
// JSON Patch (RFC 6902)
// ---------------------------------------------------------------------------

export interface JsonPatchOp {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
  from?: string;
}

// ---------------------------------------------------------------------------
// Wire protocol message types
// ---------------------------------------------------------------------------

export interface RpcCallMessage {
  type: "rpc";
  id: string;
  actor: string;
  actorId: string;
  method: string;
  input?: unknown;
}

export interface RpcResultMessage {
  type: "rpc:result";
  id: string;
  result?: unknown;
  error?: string;
}

export interface EventMessage {
  type: "event";
  actor: string;
  actorId: string;
  event: string;
  payload: unknown;
}

export interface EventSubMessage {
  type: "event:sub";
  actor: string;
  actorId: string;
}

export interface EventUnsubMessage {
  type: "event:unsub";
  actor: string;
  actorId: string;
}

export interface StateSubMessage {
  type: "state:sub";
  actor: string;
  actorId: string;
}

export interface StateUnsubMessage {
  type: "state:unsub";
  actor: string;
  actorId: string;
}

export interface StateSnapshotMessage {
  type: "state:snapshot";
  actor: string;
  actorId: string;
  state: unknown;
}

export interface StatePatchMessage {
  type: "state:patch";
  actor: string;
  actorId: string;
  patches: JsonPatchOp[];
}

export type ServerMessage =
  | RpcResultMessage
  | EventMessage
  | StateSnapshotMessage
  | StatePatchMessage;

export type ClientMessage =
  | RpcCallMessage
  | EventSubMessage
  | EventUnsubMessage
  | StateSubMessage
  | StateUnsubMessage;
