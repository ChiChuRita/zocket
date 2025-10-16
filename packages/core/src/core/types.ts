import type { StandardSchemaV1 } from "@standard-schema/spec";

export type MessageDef = { payload: StandardSchemaV1 };

export type MiddlewareFn<TCtx, TPayload, TAddedCtx> = (args: {
  ctx: TCtx;
  payload: TPayload;
}) => Promise<TAddedCtx> | TAddedCtx;

export type IncomingMessage<TDef extends MessageDef, TCtxExt = {}> = TDef & {
  _direction: "in";
  _middlewares?: ReadonlyArray<MiddlewareFn<any, any, any>>;
  _ctx?: TCtxExt;
};

export type OutgoingMessage<TDef extends MessageDef> = TDef & {
  _direction: "out";
};

export type AnyMessage = IncomingMessage<any, any> | OutgoingMessage<any>;

export type AnyRouter = {
  [key: string]: AnyMessage | AnyRouter;
};
