import type { Server as BunServer, ServerWebSocket, WebSocketHandler } from "bun";
import type { AppDef } from "@zocket/core";
import { createHandlers } from "../handler";
import type { Connection } from "../runtime";

// ---------------------------------------------------------------------------
// Bun WebSocket adapter
// ---------------------------------------------------------------------------

type WsData = { conn: BunConnectionAdapter };

let _connCounter = 0;

class BunConnectionAdapter implements Connection {
  readonly id = `bun_${++_connCounter}_${Date.now().toString(36)}`;
  ws: ServerWebSocket<WsData> | null = null;

  send(message: string): void {
    try {
      this.ws?.send(message);
    } catch {
      // WebSocket may have been closed/revoked
    }
  }
}

export interface BunHandlers {
  fetch(req: Request, server: BunServer<WsData>): Response | undefined;
  websocket: WebSocketHandler<WsData>;
}

/**
 * Create `{ fetch, websocket }` handlers shaped for `Bun.serve()`.
 *
 * ```ts
 * const zocket = createBunHandlers(app)
 * Bun.serve({ fetch: zocket.fetch, websocket: zocket.websocket, port: 3000 })
 * ```
 */
export function createBunHandlers(app: AppDef<any>): BunHandlers {
  const handlers = createHandlers(app);

  return {
    fetch(req: Request, server: BunServer<WsData>): Response | undefined {
      const conn = new BunConnectionAdapter();
      const upgraded = server.upgrade(req, { data: { conn } });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    },

    websocket: {
      open(ws: ServerWebSocket<WsData>) {
        ws.data.conn.ws = ws;
        handlers.onConnection(ws.data.conn);
      },

      message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
        handlers.onMessage(ws.data.conn, message.toString());
      },

      close(ws: ServerWebSocket<WsData>) {
        handlers.onClose(ws.data.conn);
        ws.data.conn.ws = null;
      },
    },
  };
}

/**
 * Convenience: create a Bun server with the app wired in.
 *
 * ```ts
 * const server = serve(app, { port: 3000 })
 * ```
 */
export function serve(
  app: AppDef<any>,
  options: { port?: number; hostname?: string } = {},
): BunServer<WsData> {
  const zocket = createBunHandlers(app);

  return Bun.serve({
    port: options.port ?? 0,
    hostname: options.hostname,
    fetch: zocket.fetch,
    websocket: zocket.websocket,
  });
}
