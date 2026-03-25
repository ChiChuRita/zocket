import {
  type JetStreamManager,
  RetentionPolicy,
  StorageType,
  AckPolicy,
} from "nats";

// ---------------------------------------------------------------------------
// Stream names
// ---------------------------------------------------------------------------

export const INBOUND_STREAM = "INBOUND";
export const OUTBOUND_STREAM = "OUTBOUND";

// ---------------------------------------------------------------------------
// Subject helpers
// ---------------------------------------------------------------------------

export function inboundSubject(actorType: string, actorId: string): string {
  return `inbound.${actorType}.${actorId}`;
}

export function outboundSubject(sessionId: string): string {
  return `outbound.${sessionId}`;
}

// ---------------------------------------------------------------------------
// Session lifecycle subjects (core NATS pub/sub)
// ---------------------------------------------------------------------------

export const SESSION_CONNECTED = "session.connected";
export const SESSION_DISCONNECTED = "session.disconnected";

// ---------------------------------------------------------------------------
// Stream + consumer setup (idempotent)
// ---------------------------------------------------------------------------

/** Milliseconds → nanoseconds for NATS config. */
function nanos(ms: number): number {
  return ms * 1_000_000;
}

/**
 * Ensure both INBOUND and OUTBOUND JetStream streams exist.
 * Safe to call from multiple processes — idempotent.
 */
export async function ensureStreams(jsm: JetStreamManager): Promise<void> {
  // INBOUND — actor mailbox
  await upsertStream(jsm, {
    name: INBOUND_STREAM,
    subjects: ["inbound.>"],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.Memory,
    max_age: nanos(60_000),
  });

  // OUTBOUND — client delivery buffer
  await upsertStream(jsm, {
    name: OUTBOUND_STREAM,
    subjects: ["outbound.>"],
    retention: RetentionPolicy.Limits,
    storage: StorageType.Memory,
    max_age: nanos(30_000),
  });
}

async function upsertStream(
  jsm: JetStreamManager,
  config: Parameters<JetStreamManager["streams"]["add"]>[0],
): Promise<void> {
  try {
    await jsm.streams.add(config);
  } catch (err: any) {
    // Stream already exists — that's fine
    if (err?.code === "STREAM_NAME_ALREADY_IN_USE" || err?.message?.includes("already in use")) {
      return;
    }
    throw err;
  }
}

/**
 * Ensure a durable consumer exists on a stream.
 */
export async function ensureConsumer(
  jsm: JetStreamManager,
  stream: string,
  config: {
    durable_name: string;
    filter_subject: string;
    max_ack_pending?: number;
  },
): Promise<void> {
  try {
    await jsm.consumers.add(stream, {
      durable_name: config.durable_name,
      filter_subject: config.filter_subject,
      ack_policy: AckPolicy.Explicit,
      max_ack_pending: config.max_ack_pending ?? 256,
    });
  } catch (err: any) {
    // Consumer already exists — that's fine
    if (err?.message?.includes("already exists") || err?.code === "CONSUMER_ALREADY_EXISTS") {
      return;
    }
    throw err;
  }
}
