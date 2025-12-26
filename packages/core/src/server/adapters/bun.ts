import type {
  Server as BunServer,
  ServerWebSocket,
  WebSocketHandler,
} from "bun";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Zocket } from "../../index";
import type { AnyRouter } from "../../core/types";

class BunWebSocketAdapter {
  constructor(private ws: ServerWebSocket<any>) {}

  send(message: string): void {
    this.ws.send(message);
  }

  close(): void {
    this.ws.close();
  }

  subscribe(topic: string): void {
    this.ws.subscribe(topic);
  }

  unsubscribe(topic: string): void {
    this.ws.unsubscribe(topic);
  }
}

type WebSocketData = {
  clientId: string;
  headers: Record<string, unknown>;
};

type BunZocketHandlers<TRouter extends AnyRouter = AnyRouter> = {
  fetch: (
    req: Request,
    server: BunServer<WebSocketData>
  ) => Response | undefined | Promise<Response | undefined>;
  websocket: WebSocketHandler<WebSocketData>;
  publish: (topic: string, message: string) => void;
};

export function createBunHandlers<
  THeadersSchema extends StandardSchemaV1,
  TUserContext,
  TRouter extends AnyRouter
>(
  router: TRouter,
  zocket: Zocket<THeadersSchema, TUserContext>,
  options: {
    onUpgrade: (req: { headers: Map<string, string>; url: string }) =>
      | {
          success: boolean;
          clientId?: string;
          headers?: Record<string, unknown>;
          error?: { status: number; body: string };
        }
      | Promise<{
          success: boolean;
          clientId?: string;
          headers?: Record<string, unknown>;
          error?: { status: number; body: string };
        }>;
    onOpen: (ws: any, clientId: string, headers: any) => void | Promise<void>;
    onMessage: (
      ws: any,
      clientId: string,
      message: string
    ) => void | Promise<void>;
    onClose: (ws: any, clientId: string) => void | Promise<void>;
  }
): BunZocketHandlers<TRouter> {
  const wsAdapters = new Map<
    ServerWebSocket<WebSocketData>,
    {
      adapter: BunWebSocketAdapter;
      clientId: string;
    }
  >();

  let bunServer: BunServer<WebSocketData> | null = null;

  const handlers: BunZocketHandlers<TRouter> = {
    async fetch(
      req: Request,
      server: BunServer<WebSocketData>
    ): Promise<Response | undefined> {
      bunServer = server;

      const url = new URL(req.url);
      const headers = new Map<string, string>();

      req.headers.forEach((value, key) => headers.set(key, value));
      url.searchParams.forEach((value, key) => headers.set(key, value));

      const result = await options.onUpgrade({ headers, url: req.url });

      if (!result.success) {
        return new Response(result.error?.body, {
          status: result.error?.status ?? 400,
          headers: result.error?.body?.startsWith("{")
            ? { "Content-Type": "application/json" }
            : undefined,
        });
      }

      const success = server.upgrade(req, {
        data: {
          clientId: result.clientId!,
          headers: result.headers!,
        },
      });

      if (success) return;
      return new Response("WebSocket upgrade failed", { status: 500 });
    },

    websocket: {
      async open(ws: ServerWebSocket<WebSocketData>) {
        const wsAdapter = new BunWebSocketAdapter(ws);
        wsAdapters.set(ws, {
          adapter: wsAdapter,
          clientId: ws.data.clientId,
        });
        await options.onOpen(wsAdapter, ws.data.clientId, ws.data.headers);
      },

      async message(
        ws: ServerWebSocket<WebSocketData>,
        message: string | Buffer
      ) {
        const data = wsAdapters.get(ws);
        if (data) {
          await options.onMessage(
            data.adapter,
            data.clientId,
            message.toString()
          );
        }
      },

      async close(ws: ServerWebSocket<WebSocketData>) {
        const data = wsAdapters.get(ws);
        if (data) {
          await options.onClose(data.adapter, data.clientId);
          wsAdapters.delete(ws);
        }
      },
    },

    publish(topic: string, message: string) {
      bunServer?.publish(topic, message);
    },
  };

  return handlers;
}
