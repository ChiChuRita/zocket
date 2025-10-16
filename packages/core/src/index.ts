import type { StandardSchemaV1 } from "@standard-schema/spec";
import { MessageBuilder } from "./core/builder";
import { flattenRouter, getNested } from "./core/router";
import type { AnyRouter } from "./core/types";
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
  message: MessageBuilder<TUserContext>;
  router: <TRouter extends AnyRouter>(
    routes: TRouter,
    handlers: Handlers<TRouter, TUserContext>
  ) => Record<string, any>;
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
    const message = new MessageBuilder<TUserContext>();

    const router = <TRouter extends AnyRouter>(
      routes: TRouter,
      handlers: Handlers<TRouter, TUserContext>
    ) => {
      const flat: Record<string, any> = {};
      flattenRouter(
        routes as unknown as Record<string, any>,
        handlers as unknown as Record<string, any>,
        [],
        flat
      );

      const hiddenHandlers: Record<string, any> = {};
      for (const flatKey of Object.keys(flat)) {
        const maybeHandler = getNested(
          handlers as unknown as Record<string, any>,
          flatKey.split(".")
        );
        if (typeof maybeHandler === "function") {
          hiddenHandlers[flatKey] = maybeHandler;
        }
      }
      Object.defineProperty(flat, "__handlers", {
        value: hiddenHandlers,
        enumerable: false,
        configurable: false,
        writable: false,
      });

      return flat;
    };

    return {
      headersSchema: config.headers,
      onConnect: config.onConnect,
      onDisconnect: config.onDisconnect,
      message,
      router,
    } as Zocket<THeadersSchema, TUserContext>;
  },
};

export default zocket;

export { createServer, createBunServer } from "./server/server";
export type {
  ServerAdapter,
  WebSocketAdapter,
  ServerLike,
} from "./server/types";

export { createZocketClient } from "./client/client";
export type { ZocketClient } from "./client/types";
export type { AnyRouter } from "./core/types";
