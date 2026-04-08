import type { ServerWebSocket } from "bun";
import type { ConsumerMessages } from "nats";
import type { RouteScope } from "@zocket/nats-transport";

// ---------------------------------------------------------------------------
// Session info
// ---------------------------------------------------------------------------

export interface SessionInfo {
  scope: RouteScope;
  sessionId: string;
  userId: string | null;
  claims: Record<string, unknown>;
  ws: ServerWebSocket<WsData>;
  /** JetStream consumer messages iterator for outbound delivery to this session */
  outboundSub: ConsumerMessages | null;
}

export type AuthorizedUpgradeData = {
  scope: RouteScope;
  userId: string | null;
  claims: Record<string, unknown>;
};

export type WsData = { session: SessionInfo; authorized: AuthorizedUpgradeData };

// ---------------------------------------------------------------------------
// Session manager
// ---------------------------------------------------------------------------

export class SessionManager {
  private byWs = new Map<ServerWebSocket<WsData>, SessionInfo>();
  private byId = new Map<string, SessionInfo>();

  createSession(ws: ServerWebSocket<WsData>, authorized: AuthorizedUpgradeData): SessionInfo {
    const session: SessionInfo = {
      scope: authorized.scope,
      sessionId: crypto.randomUUID(),
      userId: authorized.userId,
      claims: authorized.claims,
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
