import type { JetStreamClient } from "nats";
import type { Connection } from "@zocket/server";
import type { OutboundEnvelope } from "@zocket/nats-transport";
import { encode, outboundSubject } from "@zocket/nats-transport";

/**
 * A virtual connection that implements the server's `Connection` interface
 * by publishing messages to JetStream outbound subjects instead of writing
 * to a WebSocket directly.
 *
 * One VirtualConnection exists per client session. The actor runtime creates
 * these on first message from a session and reuses them for subsequent messages.
 */
export class VirtualConnection implements Connection {
  readonly id: string;

  constructor(
    public readonly sessionId: string,
    private readonly js: JetStreamClient,
  ) {
    this.id = sessionId;
  }

  send(message: string): void {
    const envelope: OutboundEnvelope = {
      sessionId: this.sessionId,
      message: JSON.parse(message),
    };
    // Fire-and-forget publish. JetStream on a local NATS node is reliable;
    // production would want to handle the PubAck promise.
    this.js.publish(outboundSubject(this.sessionId), encode(envelope));
  }
}
