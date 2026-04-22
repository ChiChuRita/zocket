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
  /** Opaque identifier for the client that invoked this method. Stable for one WebSocket connection. */
  clientId: string;
  /** Snapshot of client ids currently known to this actor instance (connected + subscribed). */
  clients: ReadonlySet<string>;
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
 * Builder returned by `emit(event, payload)`. Terminal methods dispatch the event;
 * without a terminal call nothing is sent. Terminals are mutually exclusive —
 * pick one per emit.
 */
export interface EmitBuilder {
  /** Deliver to the specified client id(s). Unsubscribed ids are silently skipped. */
  to(clientId: string | readonly string[]): void;
  /** Deliver to every subscribed client except the specified id(s). */
  except(clientId: string | readonly string[]): void;
  /** Deliver to every subscribed client. */
  broadcast(): void;
}

/**
 * Typed emit function — constrains event names and payload types to declared events.
 * Returns an `EmitBuilder`; you must call `.broadcast()`, `.to(...)`, or `.except(...)`
 * to actually dispatch the event.
 *
 * ```ts
 * emit("message", payload).broadcast();
 * emit("message", payload).to(clientId);
 * emit("message", payload).except(clientId);
 * ```
 */
export type TypedEmitFn<TEvents extends Record<string, any>> = <
  K extends string & keyof TEvents,
>(
  event: K,
  payload: TEvents[K] extends StandardSchemaV1
    ? InferSchema<TEvents[K]>
    : unknown,
) => EmitBuilder;

/** Untyped emit function for generic / runtime contexts */
export type EmitFn = (event: string, payload: unknown) => EmitBuilder;

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

/** Context passed to onConnect / onDisconnect lifecycle hooks */
export interface LifecycleContext<TState> {
  state: TState;
  /** Opaque client identifier — stable for the lifetime of a WebSocket. */
  clientId: string;
  /** Snapshot of client ids currently known to this actor instance. */
  clients: ReadonlySet<string>;
  /** Authenticated user identity, when the transport provides it. */
  userId: string | null;
  /** Verified auth claims or other connection-scoped metadata. */
  claims: Record<string, unknown>;
  /** Optional routing scope attached by the transport layer. */
  scope?: Record<string, string>;
  emit: EmitFn;
}

/** A lifecycle hook that can mutate state */
export type LifecycleHandler<TState> = (
  ctx: LifecycleContext<TState>,
) => void | Promise<void>;

/** Context passed to onActivate / onDeactivate actor lifecycle hooks */
export interface ActorLifecycleContext<TState> {
  state: TState;
}

/** An actor lifecycle hook that can mutate state */
export type ActorLifecycleHandler<TState> = (
  ctx: ActorLifecycleContext<TState>,
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
  /** Called when the actor instance is first created. */
  onActivate?: ActorLifecycleHandler<InferSchema<TState>>;
  /** Called before the actor instance is destroyed (eviction, shutdown, redeploy). */
  onDeactivate?: ActorLifecycleHandler<InferSchema<TState>>;
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

export interface WelcomeMessage {
  type: "welcome";
  clientId: string;
}

export type ServerMessage =
  | RpcResultMessage
  | EventMessage
  | StateSnapshotMessage
  | StatePatchMessage
  | WelcomeMessage;

export type ClientMessage =
  | RpcCallMessage
  | EventSubMessage
  | EventUnsubMessage
  | StateSubMessage
  | StateUnsubMessage;
