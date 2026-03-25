import type { ClientMessage, ServerMessage } from "@zocket/core/types";

// ---------------------------------------------------------------------------
// Inbound envelope (Gateway → Runtime via JetStream)
// Published to subject: inbound.{actorType}.{actorId}
// ---------------------------------------------------------------------------

export interface InboundEnvelope {
  sessionId: string;
  message: ClientMessage;
}

// ---------------------------------------------------------------------------
// Outbound envelope (Runtime → Gateway via JetStream)
// Published to subject: outbound.{sessionId}
// ---------------------------------------------------------------------------

export interface OutboundEnvelope {
  sessionId: string;
  message: ServerMessage;
}

// ---------------------------------------------------------------------------
// Session lifecycle notices (via core NATS pub/sub, not JetStream)
// ---------------------------------------------------------------------------

export interface SessionConnectedNotice {
  sessionId: string;
  connectedAt: number;
}

export interface SessionDisconnectedNotice {
  sessionId: string;
  disconnectedAt: number;
}
