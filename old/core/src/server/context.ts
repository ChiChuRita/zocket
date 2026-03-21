import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  AnyRouter,
  IncomingMessage,
  OutgoingMessage,
  MessageDef,
} from "../core/types";

export type FluentSender = {
  to: (clientIds: string[]) => void;
  toRoom: (roomIds: string[]) => void;
  broadcast: () => void;
};

export type Sender<TRouter extends AnyRouter> = {
  [K in keyof TRouter]: TRouter[K] extends OutgoingMessage<infer TDef>
    ? (payload: StandardSchemaV1.InferOutput<TDef["payload"]>) => FluentSender
    : TRouter[K] extends AnyRouter
    ? Sender<TRouter[K]>
    : never;
};

export type RoomOperations = {
  join: (roomId: string) => void;
  leave: (roomId: string) => void;
  broadcast: (roomId: string, route: string, payload: unknown) => void;
  current: ReadonlySet<string>;
  has: (roomId: string) => boolean;
};

export type ZocketContext<
  TUserContext,
  TRouter extends AnyRouter
> = TUserContext & {
  send: Sender<TRouter>;
  rooms: RoomOperations;
  clientId: string;
};

export type DisconnectContext<TUserContext> = TUserContext & {
  clientId: string;
  rooms: ReadonlySet<string>;
};

type HandlerFn<
  TDef extends MessageDef,
  TCtxExt,
  TUserContext,
  TRootRouter extends AnyRouter
> = (opts: {
  payload: StandardSchemaV1.InferOutput<TDef["payload"]>;
  ctx: ZocketContext<TUserContext, TRootRouter> & TCtxExt;
}) => void | Promise<void>;

export type Handlers<
  TRouter extends AnyRouter,
  TUserContext,
  TRootRouter extends AnyRouter = TRouter
> = {
  [K in keyof TRouter as TRouter[K] extends IncomingMessage<any> | AnyRouter
    ? K
    : never]?: TRouter[K] extends IncomingMessage<infer TDef, infer TCtxExt>
    ? HandlerFn<TDef, TCtxExt, TUserContext, TRootRouter>
    : TRouter[K] extends AnyRouter
    ? Handlers<TRouter[K], TUserContext, TRootRouter>
    : never;
};
