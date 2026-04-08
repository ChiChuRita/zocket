import type { JetStreamClient, NatsConnection } from "nats";
import type {
  InboundEnvelope,
  OutboundEnvelope,
  SessionConnectedNotice,
  SessionDisconnectedNotice,
} from "@zocket/nats-transport";
import {
  encode,
  decode,
  inboundSubject,
  outboundSubject,
  OUTBOUND_STREAM,
  sessionConnectedSubject,
  sessionDisconnectedSubject,
} from "@zocket/nats-transport";
import type { SessionInfo, SessionManager } from "./session";

/**
 * Bridges WebSocket sessions to NATS/JetStream.
 *
 * - Publishes client messages to JetStream inbound subjects
 * - Consumes outbound JetStream messages per session and forwards to WebSocket
 * - Publishes session lifecycle notices on core NATS
 */
export class NatsBridge {
  constructor(
    private readonly js: JetStreamClient,
    private readonly nc: NatsConnection,
    private readonly sessions: SessionManager,
  ) {}

  /**
   * Publish a client protocol message to the inbound JetStream stream.
   * Parses just enough to extract actor + actorId for the subject.
   */
  async publishInbound(session: SessionInfo, raw: string): Promise<void> {
    try {
      const msg = JSON.parse(raw);
      if (!msg || typeof msg.actor !== "string" || typeof msg.actorId !== "string") {
        return; // Not a routable message
      }

      const envelope: InboundEnvelope = {
        scope: session.scope,
        sessionId: session.sessionId,
        userId: session.userId,
        claims: session.claims,
        message: msg,
      };

      await this.js.publish(
        inboundSubject(
          session.scope.workspaceId,
          session.scope.projectId,
          msg.actor,
          msg.actorId,
        ),
        encode(envelope),
      );
    } catch (err) {
      console.error("[gateway] Failed to publish inbound:", err);
    }
  }

  /**
   * Start an outbound JetStream consumer for a session.
   * Messages are forwarded to the WebSocket connection.
   */
  async startOutboundConsumer(session: SessionInfo): Promise<void> {
    try {
      const consumer = await this.js.consumers.get(OUTBOUND_STREAM, {
        filterSubjects: [
          outboundSubject(
            session.scope.workspaceId,
            session.scope.projectId,
            session.sessionId,
          ),
        ],
      });

      const sub = await consumer.consume();
      session.outboundSub = sub;

      // Process outbound messages in the background.
      // This is an ordered consumer (ephemeral, no ack required).
      (async () => {
        for await (const msg of sub) {
          try {
            const envelope = decode<OutboundEnvelope>(msg.data);
            session.ws.send(JSON.stringify(envelope.message));
          } catch (err) {
            console.error("[gateway] Error forwarding outbound:", err);
          }
        }
      })();
    } catch (err) {
      console.error("[gateway] Failed to start outbound consumer:", err);
    }
  }

  /**
   * Stop the outbound consumer for a session.
   */
  async stopOutboundConsumer(session: SessionInfo): Promise<void> {
    if (session.outboundSub) {
      try {
        session.outboundSub.stop();
      } catch {
        // Already stopped
      }
      session.outboundSub = null;
    }
  }

  /**
   * Publish a session connected notice on core NATS.
   */
  notifyConnected(session: SessionInfo): void {
    const notice: SessionConnectedNotice = {
      scope: session.scope,
      sessionId: session.sessionId,
      userId: session.userId,
      connectedAt: Date.now(),
    };
    this.nc.publish(
      sessionConnectedSubject(session.scope.workspaceId, session.scope.projectId),
      encode(notice),
    );
  }

  /**
   * Publish a session disconnected notice on core NATS.
   */
  notifyDisconnected(session: SessionInfo): void {
    const notice: SessionDisconnectedNotice = {
      scope: session.scope,
      sessionId: session.sessionId,
      disconnectedAt: Date.now(),
    };
    this.nc.publish(
      sessionDisconnectedSubject(session.scope.workspaceId, session.scope.projectId),
      encode(notice),
    );
  }
}
