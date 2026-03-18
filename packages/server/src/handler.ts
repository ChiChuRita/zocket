import type { AppDef } from "@zocket/core";
import type { ClientMessage } from "@zocket/core/types";
import { parseMessage, rpcResult, MSG } from "@zocket/core/protocol";
import { ActorManager, type Connection } from "./runtime.js";

// ---------------------------------------------------------------------------
// Core handler — wired by platform adapters
// ---------------------------------------------------------------------------

export interface HandlerCallbacks {
  onConnection(conn: Connection): void;
  onMessage(conn: Connection, raw: string): void;
  onClose(conn: Connection): void;
}

export function createHandlers(app: AppDef<any>): HandlerCallbacks {
  const manager = new ActorManager(app.actors);

  return {
    onConnection(_conn: Connection) {
      // no-op for now; subscriptions happen via messages
    },

    async onMessage(conn: Connection, raw: string) {
      const msg = parseMessage(raw) as ClientMessage | null;
      if (!msg) return;

      switch (msg.type) {
        case MSG.RPC: {
          try {
            const instance = await manager.getOrCreate(msg.actor, msg.actorId);
            const result = await instance.invoke(msg.method, msg.input, conn);
            conn.send(JSON.stringify(rpcResult(msg.id, result)));
          } catch (err: any) {
            try {
              conn.send(
                JSON.stringify(rpcResult(msg.id, undefined, err?.message ?? "Unknown error")),
              );
            } catch {
              // Connection may have closed
            }
          }
          break;
        }

        case MSG.EVENT_SUB: {
          try {
            const instance = await manager.getOrCreate(msg.actor, msg.actorId);
            instance.subscribeEvents(conn);
          } catch {
            // ignore
          }
          break;
        }

        case MSG.EVENT_UNSUB: {
          try {
            const instance = await manager.getOrCreate(msg.actor, msg.actorId);
            instance.unsubscribeEvents(conn);
          } catch {
            // ignore
          }
          break;
        }

        case MSG.STATE_SUB: {
          try {
            const instance = await manager.getOrCreate(msg.actor, msg.actorId);
            instance.subscribeState(conn);
          } catch {
            // ignore
          }
          break;
        }

        case MSG.STATE_UNSUB: {
          try {
            const instance = await manager.getOrCreate(msg.actor, msg.actorId);
            instance.unsubscribeState(conn);
          } catch {
            // ignore
          }
          break;
        }
      }
    },

    onClose(conn: Connection) {
      manager.removeConnection(conn);
    },
  };
}
