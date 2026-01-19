import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Zocket } from "../index";
import type {
  ServerAdapter,
  WebSocketAdapter,
  RequestLike,
  UpgradeResult,
  ServerLike,
  ZocketServer,
} from "./types";
import type { AnyRouter } from "../core/types";
import type { Sender, ZocketContext, RoomOperations } from "./context";
import { createBunHandlers } from "./adapters/bun";
import { flattenRouter } from "../core/router";
import { requestContext } from "../core/context-store"; // Import the store

function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createSendProxy<TRouter extends AnyRouter>(
  clientId: string,
  clientConnections: Map<string, WebSocketAdapter>,
  serverPublishRef?: { fn?: (topic: string, message: string) => void }
): Sender<TRouter> {
  const createInnerProxy = (path: string[]): any => {
    const sender = (payload: unknown) => {
      const route = path.join(".");
      const message = JSON.stringify({ type: route, payload });

      return {
        to: (clientIds: string[]) => {
          clientIds.forEach((targetClientId) => {
            const targetWs = clientConnections.get(targetClientId);
            if (targetWs) {
              try {
                targetWs.send(message);
              } catch (error) {
                console.error(
                  `SERVER: Failed to send to client ${targetClientId}:`,
                  error
                );
              }
            }
          });
        },
        toRoom: (roomIds: string[]) => {
          if (serverPublishRef?.fn) {
            roomIds.forEach((roomId) => {
              serverPublishRef.fn!(roomId, message);
            });
          } else {
            console.warn(
              "SERVER: Room publishing not supported by this adapter"
            );
          }
        },
        broadcast: () => {
          clientConnections.forEach((clientWs) => {
            try {
              clientWs.send(message);
            } catch (error) {
              console.error("SERVER: Failed to broadcast message:", error);
            }
          });
        },
      };
    };
    return new Proxy(sender, {
      get: (_target, prop: string) => createInnerProxy([...path, prop]),
    });
  };
  return createInnerProxy([]) as Sender<TRouter>;
}

type HandlerMaps = {
  handlerMap: Map<string, Function>;
  metaMap: Map<
    string,
    { payloadSchema?: StandardSchemaV1; middlewares: Array<(args: any) => any> }
  >;
};

function initializeHandlerMaps(router: Record<string, any>): HandlerMaps {
  const handlerMap = new Map<string, Function>();
  const metaMap = new Map<
    string,
    { payloadSchema?: StandardSchemaV1; middlewares: Array<(args: any) => any> }
  >();

  for (const key in router) {
    const def = router[key];
    if (!def) continue;
    if (def?.handler) {
      handlerMap.set(key, def.handler);
    }
    metaMap.set(key, {
      payloadSchema: def?.payload,
      middlewares: Array.isArray(def?._middlewares) ? def._middlewares : [],
    });
  }

  const hiddenHandlers = (router as any).__handlers as
    | Record<string, Function>
    | undefined;
  if (hiddenHandlers) {
    for (const [key, fn] of Object.entries(hiddenHandlers)) {
      if (!handlerMap.has(key)) handlerMap.set(key, fn);
    }
  }

  return { handlerMap, metaMap };
}

function createUpgradeHandler<THeadersSchema extends StandardSchemaV1>(
  zocket: Zocket<THeadersSchema, any>
) {
  return async (req: RequestLike): Promise<UpgradeResult> => {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    try {
      const result = await zocket.headersSchema["~standard"].validate(headers);

      if (result.issues) {
        return {
          success: false,
          error: {
            status: 400,
            body: JSON.stringify({
              error: "Invalid headers",
              details: result.issues,
            }),
          },
        };
      }

      const clientId = generateClientId();

      return {
        success: true,
        clientId,
        headers: result.value as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          status: 400,
          body: "Header validation error",
        },
      };
    }
  };
}

function createOpenHandler<
  THeadersSchema extends StandardSchemaV1,
  TUserContext
>(
  zocket: Zocket<THeadersSchema, TUserContext>,
  clientConnections: Map<string, WebSocketAdapter>,
  clientContexts: Map<string, ZocketContext<TUserContext, AnyRouter>>,
  clientRooms: Map<string, Set<string>>,
  pendingContexts: Map<string, Promise<void>>,
  serverPublishRef?: { fn?: (topic: string, message: string) => void }
) {
  return async (ws: WebSocketAdapter, clientId: string, headers: any) => {
    const initPromise = (async () => {
      clientConnections.set(clientId, ws);

      const rooms = new Set<string>();
      clientRooms.set(clientId, rooms);

      const roomOps: RoomOperations = {
        join: (roomId: string) => {
          rooms.add(roomId);
          ws.subscribe(roomId);
        },
        leave: (roomId: string) => {
          rooms.delete(roomId);
          ws.unsubscribe(roomId);
        },
        broadcast: (roomId: string, route: string, payload: unknown) => {
          const message = JSON.stringify({ type: route, payload });
          serverPublishRef?.fn?.(roomId, message);
        },
        current: rooms as ReadonlySet<string>,
        has: (roomId: string) => rooms.has(roomId),
      };

      const sendProxy = createSendProxy<AnyRouter>(
        clientId,
        clientConnections,
        serverPublishRef
      );

      const userContext =
        (await Promise.resolve(zocket.onConnect?.(headers, clientId))) ??
        ({} as TUserContext);

      const ctx: ZocketContext<TUserContext, AnyRouter> = {
        ...userContext,
        send: sendProxy,
        rooms: roomOps,
        clientId,
      };

      clientContexts.set(clientId, ctx);
    })();

    pendingContexts.set(clientId, initPromise);
    await initPromise;
    pendingContexts.delete(clientId);
  };
}

function createMessageHandler<TUserContext>(
  handlerMap: Map<string, Function>,
  metaMap: Map<
    string,
    { payloadSchema?: StandardSchemaV1; middlewares: Array<(args: any) => any> }
  >,
  clientContexts: Map<string, ZocketContext<TUserContext, AnyRouter>>,
  pendingContexts: Map<string, Promise<void>>
) {
  return async (ws: WebSocketAdapter, clientId: string, message: string) => {
    try {
      const data = JSON.parse(message);

      if (
        typeof data !== "object" ||
        data === null ||
        typeof data.type !== "string"
      ) {
        console.warn("SERVER: Invalid message format received:", data);
        return;
      }

      const { type, payload, rpcId } = data;
      const handler = handlerMap.get(type);
      const meta = metaMap.get(type);

      const pending = pendingContexts.get(clientId);
      if (pending) {
        await pending;
      }

      const ctx = clientContexts.get(clientId);

      if (handler && ctx) {
        let parsedPayload: unknown = payload;
        if (meta?.payloadSchema) {
          try {
            const result = await meta.payloadSchema["~standard"].validate(
              payload
            );

            if (result.issues) {
              console.warn(
                `SERVER: Invalid payload for message "${type}":`,
                result.issues
              );
              return;
            }

            parsedPayload = result.value;
          } catch (err) {
            console.warn(`SERVER: Payload parsing error for "${type}"`, err);
            return;
          }
        }

        const currentCtx = { ...ctx } as ZocketContext<any, AnyRouter>;

        // Wrap execution in AsyncLocalStorage so getContext() works in middlewares and handlers
        await requestContext.run(currentCtx, async () => {
          if (meta && meta.middlewares.length > 0) {
            for (const mw of meta.middlewares) {
              try {
                const add = await Promise.resolve(
                  mw({
                    ctx: currentCtx,
                    payload: parsedPayload,
                  })
                );
                if (add && typeof add === "object") {
                  Object.assign(currentCtx, add);
                }
              } catch (err) {
                console.warn(
                  `SERVER: Middleware error for message "${type}":`,
                  err
                );
                return;
              }
            }
          }

          const result = await handler({
            payload: parsedPayload,
            ctx: currentCtx,
          });

          if (rpcId) {
            ws.send(
              JSON.stringify({
                type: "__rpc_res",
                payload: result,
                rpcId,
              })
            );
          }
        });
      } else if (!handler) {
        console.warn(`SERVER: No handler found for message type: "${type}"`);
      }
    } catch (error) {
      console.error("SERVER: Error processing message:", error);
    }
  };
}

function createCloseHandler<
  THeadersSchema extends StandardSchemaV1,
  TUserContext
>(
  zocket: Zocket<THeadersSchema, TUserContext>,
  clientConnections: Map<string, WebSocketAdapter>,
  clientContexts: Map<string, ZocketContext<TUserContext, AnyRouter>>,
  clientRooms: Map<string, Set<string>>
) {
  return async (ws: WebSocketAdapter, clientId: string) => {
    const ctx = clientContexts.get(clientId);
    const rooms = clientRooms.get(clientId);

    if (ctx && zocket.onDisconnect) {
      const { send, rooms: roomOps, ...userContext } = ctx;
      const disconnectCtx = {
        ...userContext,
        rooms: rooms ?? new Set<string>(),
        clientId,
      };
      await Promise.resolve(
        zocket.onDisconnect(disconnectCtx as any, clientId)
      );
    }

    clientConnections.delete(clientId);
    clientContexts.delete(clientId);
    clientRooms.delete(clientId);
  };
}

export function createServer<
  THeadersSchema extends StandardSchemaV1,
  TUserContext,
  TRouter extends AnyRouter
>(
  router: TRouter,
  zocket: Zocket<THeadersSchema, TUserContext>,
  adapter: ServerAdapter,
  options: { port?: number; hostname?: string } = {}
): ZocketServer<TRouter> {
  const clientConnections = new Map<string, WebSocketAdapter>();
  const clientContexts = new Map<
    string,
    ZocketContext<TUserContext, AnyRouter>
  >();
  const clientRooms = new Map<string, Set<string>>();
  const pendingContexts = new Map<string, Promise<void>>();

  const flatRouter: Record<string, any> = {};
  const legacyHandlers = (router as any).__handlers;
  flattenRouter(router, legacyHandlers, [], flatRouter);

  const { handlerMap, metaMap } = initializeHandlerMaps(flatRouter);

  const serverPublishRef = {
    fn: undefined as ((topic: string, message: string) => void) | undefined,
  };

  const server = adapter.start({
    port: options.port,
    hostname: options.hostname,
    onUpgrade: createUpgradeHandler(zocket),
    onOpen: createOpenHandler(
      zocket,
      clientConnections,
      clientContexts,
      clientRooms,
      pendingContexts,
      serverPublishRef
    ),
    onMessage: createMessageHandler(
      handlerMap,
      metaMap,
      clientContexts,
      pendingContexts
    ),
    onClose: createCloseHandler(
      zocket,
      clientConnections,
      clientContexts,
      clientRooms
    ),
  });

  const serverPublish = server.publish?.bind(server);
  if (serverPublish) {
    serverPublishRef.fn = serverPublish;
  }

  const send = createSendProxy<TRouter>(
    "server",
    clientConnections,
    serverPublishRef
  );
  (server as ZocketServer<TRouter>).send = send;

  console.log(`SERVER: Listening on http://localhost:${server.port}`);

  return server as ZocketServer<TRouter>;
}

export function createBunServer<
  THeadersSchema extends StandardSchemaV1,
  TUserContext,
  TRouter extends AnyRouter
>(router: TRouter, zocket: Zocket<THeadersSchema, TUserContext>) {
  const clientConnections = new Map<string, WebSocketAdapter>();
  const clientContexts = new Map<
    string,
    ZocketContext<TUserContext, AnyRouter>
  >();
  const clientRooms = new Map<string, Set<string>>();
  const pendingContexts = new Map<string, Promise<void>>();

  const flatRouter: Record<string, any> = {};
  const legacyHandlers = (router as any).__handlers;
  flattenRouter(router, legacyHandlers, [], flatRouter);

  const { handlerMap, metaMap } = initializeHandlerMaps(flatRouter);

  const serverPublishRef = {
    fn: undefined as ((topic: string, message: string) => void) | undefined,
  };

  const handlers = createBunHandlers(router, zocket, {
    onUpgrade: createUpgradeHandler(zocket),
    onOpen: createOpenHandler(
      zocket,
      clientConnections,
      clientContexts,
      clientRooms,
      pendingContexts,
      serverPublishRef
    ),
    onMessage: createMessageHandler(
      handlerMap,
      metaMap,
      clientContexts,
      pendingContexts
    ),
    onClose: createCloseHandler(
      zocket,
      clientConnections,
      clientContexts,
      clientRooms
    ),
  });

  serverPublishRef.fn = handlers.publish;

  const send = createSendProxy<TRouter>(
    "server",
    clientConnections,
    serverPublishRef
  );

  return { ...handlers, send };
}
