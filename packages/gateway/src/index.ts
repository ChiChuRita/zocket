import { connect } from "nats";
import { ensureStreams } from "@zocket/nats-transport";
import { SessionManager, type AuthorizedUpgradeData, type WsData } from "./session";
import { NatsBridge } from "./nats-bridge";
import { authorizeProject } from "./control-plane";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";
const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function authorizeRequest(req: Request): Promise<AuthorizedUpgradeData> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const host = req.headers.get("host");

  if (!host) {
    throw new Error("Missing host header");
  }

  const payload = await authorizeProject(host, token);
  return {
    scope: {
      workspaceId: payload.workspaceId,
      projectId: payload.projectId,
    },
    userId: payload.userId,
    claims: payload.claims ?? {},
  };
}

function handleHealthCheck(req: Request): Response | null {
  const pathname = new URL(req.url).pathname;
  if (pathname !== "/health") {
    return null;
  }

  return new Response(
    JSON.stringify({
      ok: true,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

async function handleGatewayRequest(req: Request, server: Bun.Server<WsData>) {
  try {
    const health = handleHealthCheck(req);
    if (health) {
      return health;
    }

    const authorized = await authorizeRequest(req);
    const upgraded = server.upgrade(req, {
      data: {
        session: null!,
        authorized,
      },
    });
    if (upgraded) return undefined;
    return new Response("Zocket Gateway — WebSocket upgrade required", { status: 426 });
  } catch (error: any) {
    return new Response(error?.message ?? "Unauthorized", { status: 401 });
  }
}

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

Bun.serve<WsData>({
  port: PORT,

  fetch(req, server) {
    return handleGatewayRequest(req, server);
  },

  websocket: {
    open(ws) {
      const session = sessions.createSession(ws, ws.data.authorized);
      ws.data.session = session;
      bridge.startOutboundConsumer(session);
      bridge.notifyConnected(session);
      console.log(
        `[gateway] Session ${session.sessionId} connected (${session.scope.workspaceId}/${session.scope.projectId})`,
      );
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
