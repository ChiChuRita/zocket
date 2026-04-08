import type { JetStreamClient, NatsConnection, ConsumerMessages, Subscription } from "nats";
import type { HandlerCallbacks } from "@zocket/server";
import type { InboundEnvelope } from "@zocket/nats-transport";
import {
  decode,
  INBOUND_STREAM,
  sessionDisconnectedSubject,
} from "@zocket/nats-transport";
import { VirtualConnection } from "./virtual-connection";

/**
 * Manages JetStream consumers that feed inbound messages into the
 * handler callbacks produced by `createHandlers()`.
 *
 * Supports stop() for hot-reload: stops all consumers and cleans up.
 */
export class ConsumerManager {
  private connections = new Map<string, VirtualConnection>();
  private activeConsumers: ConsumerMessages[] = [];
  private sessionSub: Subscription | null = null;
  private stopped = false;

  constructor(
    private readonly js: JetStreamClient,
    private readonly nc: NatsConnection,
    private readonly handlers: HandlerCallbacks,
    private readonly scope: { workspaceId: string; projectId: string },
  ) {}

  /**
   * Start consuming inbound messages for a set of actor types
   * and listening for session disconnect notices.
   */
  async start(actorTypes: string[]): Promise<void> {
    this.stopped = false;

    // Listen for session disconnects on core NATS
    this.sessionSub = this.nc.subscribe(sessionDisconnectedSubject(
      this.scope.workspaceId,
      this.scope.projectId,
    ), {
      callback: (_err, msg) => {
        if (_err || this.stopped) return;
        try {
          const notice = decode<{ sessionId: string }>(msg.data);
          this.handleSessionDisconnected(notice.sessionId);
        } catch {
          // Malformed notice, ignore
        }
      },
    });

    // Start a consumer for each actor type (don't await — they run forever)
    for (const type of actorTypes) {
      this.consumeActorType(type);
    }
  }

  /**
   * Stop all consumers and clean up connections.
   */
  async stop(): Promise<void> {
    this.stopped = true;

    // Stop all JetStream consumers
    for (const consumer of this.activeConsumers) {
      try {
        consumer.stop();
      } catch {
        // Already stopped
      }
    }
    this.activeConsumers = [];

    // Unsubscribe session disconnect listener
    if (this.sessionSub) {
      this.sessionSub.unsubscribe();
      this.sessionSub = null;
    }

    // Clean up all virtual connections
    for (const conn of this.connections.values()) {
      this.handlers.onClose(conn);
    }
    this.connections.clear();
  }

  private async consumeActorType(actorType: string): Promise<void> {
    const consumerName = `rt-${this.scope.workspaceId}-${this.scope.projectId}-${actorType}`;

    const consumer = await this.js.consumers.get(INBOUND_STREAM, consumerName);
    const messages = await consumer.consume();
    this.activeConsumers.push(messages);

    for await (const msg of messages) {
      if (this.stopped) break;
      try {
        const envelope = decode<InboundEnvelope>(msg.data);
        await this.handleInbound(envelope);
        msg.ack();
      } catch (err) {
        console.error(`[runtime] Error processing message for ${actorType}:`, err);
        msg.ack();
      }
    }
  }

  private async handleInbound(envelope: InboundEnvelope): Promise<void> {
    const conn = this.getOrCreateConnection(
      envelope.sessionId,
      envelope.userId,
      envelope.claims,
    );
    await this.handlers.onMessage(conn, JSON.stringify(envelope.message));
  }

  private handleSessionDisconnected(sessionId: string): void {
    const conn = this.connections.get(sessionId);
    if (!conn) return;
    this.handlers.onClose(conn);
    this.connections.delete(sessionId);
  }

  private getOrCreateConnection(
    sessionId: string,
    userId: string | null,
    claims: Record<string, unknown>,
  ): VirtualConnection {
    let conn = this.connections.get(sessionId);
    if (!conn) {
      conn = new VirtualConnection(sessionId, this.js, this.scope, userId, claims);
      this.connections.set(sessionId, conn);
      this.handlers.onConnection(conn);
    }
    return conn;
  }
}
