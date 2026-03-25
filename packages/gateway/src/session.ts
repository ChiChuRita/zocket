import type { ServerWebSocket } from "bun";
import type { ConsumerMessages } from "nats";

// ---------------------------------------------------------------------------
// Session info
// ---------------------------------------------------------------------------

export interface SessionInfo {
  sessionId: string;
  ws: ServerWebSocket<WsData>;
  /** JetStream consumer messages iterator for outbound delivery to this session */
  outboundSub: ConsumerMessages | null;
}

export type WsData = { session: SessionInfo };

// ---------------------------------------------------------------------------
// Session manager
// ---------------------------------------------------------------------------

export class SessionManager {
  private byWs = new Map<ServerWebSocket<WsData>, SessionInfo>();
  private byId = new Map<string, SessionInfo>();

  createSession(ws: ServerWebSocket<WsData>): SessionInfo {
    const session: SessionInfo = {
      sessionId: crypto.randomUUID(),
      ws,
      outboundSub: null,
    };
    this.byWs.set(ws, session);
    this.byId.set(session.sessionId, session);
    return session;
  }

  getByWs(ws: ServerWebSocket<WsData>): SessionInfo | undefined {
    return this.byWs.get(ws);
  }

  getById(id: string): SessionInfo | undefined {
    return this.byId.get(id);
  }

  removeSession(ws: ServerWebSocket<WsData>): SessionInfo | undefined {
    const session = this.byWs.get(ws);
    if (!session) return undefined;
    this.byWs.delete(ws);
    this.byId.delete(session.sessionId);
    return session;
  }
}
