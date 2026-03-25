import { connect } from "nats";
import { ensureStreams } from "@zocket/nats-transport";
import { SessionManager, type WsData } from "./session";
import { NatsBridge } from "./nats-bridge";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";
const PORT = parseInt(process.env.PORT ?? "3000", 10);

// ---------------------------------------------------------------------------
// Connect to NATS
// ---------------------------------------------------------------------------

console.log(`[gateway] Connecting to NATS at ${NATS_URL}`);
const nc = await connect({
  servers: NATS_URL,
  maxReconnectAttempts: -1,
  reconnectTimeWait: 1000,
});
console.log("[gateway] Connected to NATS");

const jsm = await nc.jetstreamManager();
const js = nc.jetstream();

// ---------------------------------------------------------------------------
// Ensure streams exist
// ---------------------------------------------------------------------------

await ensureStreams(jsm);
console.log("[gateway] JetStream streams ready");

// ---------------------------------------------------------------------------
// Session manager + NATS bridge
// ---------------------------------------------------------------------------

const sessions = new SessionManager();
const bridge = new NatsBridge(js, nc, sessions);

// ---------------------------------------------------------------------------
// Bun WebSocket server
// ---------------------------------------------------------------------------

Bun.serve<WsData>({
  port: PORT,

  fetch(req, server) {
    const upgraded = server.upgrade(req, { data: { session: null! } });
    if (upgraded) return undefined;
    return new Response("Zocket Gateway — WebSocket upgrade required", { status: 426 });
  },

  websocket: {
    open(ws) {
      const session = sessions.createSession(ws);
      ws.data.session = session;
      bridge.startOutboundConsumer(session);
      bridge.notifyConnected(session);
      console.log(`[gateway] Session ${session.sessionId} connected`);
    },

    message(ws, data) {
      const session = sessions.getByWs(ws);
      if (!session) return;
      bridge.publishInbound(session, data.toString());
    },

    close(ws) {
      const session = sessions.removeSession(ws);
      if (!session) return;
      bridge.stopOutboundConsumer(session);
      bridge.notifyDisconnected(session);
      console.log(`[gateway] Session ${session.sessionId} disconnected`);
    },
  },
});

console.log(`[gateway] Listening on ws://localhost:${PORT}`);
