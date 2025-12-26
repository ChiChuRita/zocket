import type { StandardSchemaV1 } from "@standard-schema/spec";
import { MessageBuilder, RouterBuilder, mergeRouters } from "./core/builder";
import { flattenRouter, getNested } from "./core/router";
import type { AnyRouter, BaseContext } from "./core/types";
import type { DisconnectContext, Handlers } from "./server/context";

export type Zocket<
  THeadersSchema extends StandardSchemaV1,
  TUserContext = {}
> = {
  headersSchema: THeadersSchema;
  onConnect?: (
    headers: StandardSchemaV1.InferOutput<THeadersSchema>,
    clientId: string
  ) => TUserContext | Promise<TUserContext>;
  onDisconnect?: (
    ctx: DisconnectContext<TUserContext>,
    clientId: string
  ) => void | Promise<void>;
  message: MessageBuilder<TUserContext & BaseContext>;
  router: () => RouterBuilder<{}>;
};

export const zocket = {
  create<THeadersSchema extends StandardSchemaV1, TUserContext = {}>(config: {
    headers: THeadersSchema;
    onConnect?: (
      headers: StandardSchemaV1.InferOutput<THeadersSchema>,
      clientId: string
    ) => TUserContext | Promise<TUserContext>;
    onDisconnect?: (
      ctx: DisconnectContext<TUserContext>,
      clientId: string
    ) => void | Promise<void>;
  }): Zocket<THeadersSchema, TUserContext> {
    const message = new MessageBuilder<TUserContext & BaseContext>();

    return {
      headersSchema: config.headers,
      onConnect: config.onConnect,
      onDisconnect: config.onDisconnect,
      message,
      router: () => new RouterBuilder(),
    } as Zocket<THeadersSchema, TUserContext>;
  },

  // Global helpers
  message: new MessageBuilder(),
  router: () => new RouterBuilder(),
  mergeRouters,
};

export default zocket;

export { createServer, createBunServer } from "./server/server";
export type {
  ServerAdapter,
  WebSocketAdapter,
  ServerLike,
  ZocketServer,
} from "./server/types";

export type { AnyRouter } from "./core/types";
export type {
  IncomingMessage,
  OutgoingMessage,
  MessageDef,
  MiddlewareFn,
} from "./core/types";
