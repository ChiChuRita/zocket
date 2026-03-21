import type { StandardSchemaV1 } from "@standard-schema/spec";

export type MessageDef = { payload: StandardSchemaV1 };

export type OutgoingDefinitions = {
  [key: string]: StandardSchemaV1 | OutgoingDefinitions;
};

export type MiddlewareFn<TCtx, TPayload, TAddedCtx> = (args: {
  ctx: TCtx;
  payload: TPayload;
}) => Promise<TAddedCtx> | TAddedCtx;

export type FluentSender = {
  to: (clientIds: string[]) => void;
  toRoom: (roomIds: string[]) => void;
  broadcast: () => void;
};

export type RoomOperations = {
  join: (roomId: string) => void;
  leave: (roomId: string) => void;
  broadcast: (roomId: string, route: string, payload: unknown) => void;
  current: ReadonlySet<string>;
  has: (roomId: string) => boolean;
};

export type BaseContext = {
  clientId: string;
  rooms: RoomOperations;
};

export type IncomingMessage<TDef extends MessageDef, TCtxExt = {}, TOutput = any> = TDef & {
  _direction: "in";
  _middlewares?: ReadonlyArray<MiddlewareFn<any, any, any>>;
  _ctx?: TCtxExt;
  _output?: TOutput;
  handler?: (args: any) => TOutput | Promise<TOutput>;
};

export type OutgoingMessage<TDef extends MessageDef> = TDef & {
  _direction: "out";
};

export type AnyMessage = IncomingMessage<any, any> | OutgoingMessage<any>;

export type AnyRouter = {
  [key: string]: AnyMessage | AnyRouter;
};

export type TypedSender<TOutgoing extends OutgoingDefinitions> = {
  [K in keyof TOutgoing]: TOutgoing[K] extends StandardSchemaV1
    ? (payload: StandardSchemaV1.InferOutput<TOutgoing[K]>) => FluentSender
    : TOutgoing[K] extends OutgoingDefinitions
    ? TypedSender<TOutgoing[K]>
    : never;
};

export type HandlerDefinition<TCtx, TInput extends StandardSchemaV1, TOutput = any> = {
  _type: "handler";
  input: TInput;
  middlewares: MiddlewareFn<any, any, any>[];
  handler: (args: {
    ctx: TCtx;
    input: StandardSchemaV1.InferOutput<TInput>;
    send: any;
  }) => TOutput | Promise<TOutput>;
};

// --- Type Helpers for Router Inference ---

export type ToOutgoingRouter<T extends OutgoingDefinitions> = {
  [K in keyof T]: T[K] extends StandardSchemaV1
    ? OutgoingMessage<{ payload: T[K] }>
    : T[K] extends OutgoingDefinitions
    ? ToOutgoingRouter<T[K]>
    : never;
};

export type ToIncomingRouter<T> = {
  [K in keyof T]: T[K] extends HandlerDefinition<any, infer TInput, infer TOutput>
    ? IncomingMessage<{ payload: TInput }, {}, TOutput>
    : ToIncomingRouter<T[K]>;
};

// Deep Merge for Router Types
export type MergeRouters<A, B> = {
  [K in keyof A | keyof B]: K extends keyof A
    ? K extends keyof B
      ? MergeRouters<A[K], B[K]> // Merge nested
      : A[K]
    : K extends keyof B
    ? B[K]
    : never;
};
