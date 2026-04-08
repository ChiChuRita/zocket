import type { ClientMessage, ServerMessage } from "@zocket/core/types";

// ---------------------------------------------------------------------------
// Inbound envelope (Gateway → Runtime via JetStream)
// Published to subject: inbound.{workspaceId}.{projectId}.{actorType}.{actorId}
// ---------------------------------------------------------------------------

export interface RouteScope {
  workspaceId: string;
  projectId: string;
}

export interface InboundEnvelope {
  scope: RouteScope;
  sessionId: string;
  userId: string | null;
  claims: Record<string, unknown>;
  message: ClientMessage;
}

// ---------------------------------------------------------------------------
// Outbound envelope (Runtime → Gateway via JetStream)
// Published to subject: outbound.{workspaceId}.{projectId}.{sessionId}
// ---------------------------------------------------------------------------

export interface OutboundEnvelope {
  scope: RouteScope;
  sessionId: string;
  message: ServerMessage;
}

// ---------------------------------------------------------------------------
// Session lifecycle notices (via core NATS pub/sub, not JetStream)
// ---------------------------------------------------------------------------

export interface SessionConnectedNotice {
  scope: RouteScope;
  sessionId: string;
  userId: string | null;
  connectedAt: number;
}

export interface SessionDisconnectedNotice {
  scope: RouteScope;
  sessionId: string;
  disconnectedAt: number;
}
