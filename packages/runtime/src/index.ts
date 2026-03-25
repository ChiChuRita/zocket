import { connect } from "nats";
import { createHandlers } from "@zocket/server";
import { ensureStreams, ensureConsumer, INBOUND_STREAM } from "@zocket/nats-transport";
import type { AppDef } from "@zocket/core";
import { ConsumerManager } from "./consumer";
import { createApi } from "./api";
import { mkdir } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";
const API_PORT = parseInt(process.env.API_PORT ?? "8080", 10);
const BUNDLE_DIR = process.env.BUNDLE_DIR ?? "/app/bundles";

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

let consumerManager: ConsumerManager | null = null;
let currentActorTypes: string[] = [];
let deployCount = 0;

// ---------------------------------------------------------------------------
// Connect to NATS
// ---------------------------------------------------------------------------

console.log(`[runtime] Connecting to NATS at ${NATS_URL}`);
const nc = await connect({
  servers: NATS_URL,
  maxReconnectAttempts: -1,
  reconnectTimeWait: 1000,
});
console.log("[runtime] Connected to NATS");

const jsm = await nc.jetstreamManager();
const js = nc.jetstream();
await ensureStreams(jsm);

// ---------------------------------------------------------------------------
// Deploy a bundle
// ---------------------------------------------------------------------------

async function deploy(bundlePath: string): Promise<{ actorTypes: string[] }> {
  console.log(`[runtime] Deploying bundle from ${bundlePath}`);

  if (consumerManager) {
    console.log("[runtime] Stopping existing consumers...");
    await consumerManager.stop();
    consumerManager = null;
  }

  const mod = await import(`${bundlePath}?v=${Date.now()}`);
  const appDef: AppDef = mod.registry ?? mod.app ?? mod.default;

  if (!appDef || appDef._tag !== "AppDef") {
    throw new Error("Bundle must export an AppDef (via setup() or createApp())");
  }

  const actorTypes = Object.keys(appDef.actors);
  console.log(`[runtime] Actor types: ${actorTypes.join(", ")}`);

  for (const actorType of actorTypes) {
    await ensureConsumer(jsm, INBOUND_STREAM, {
      durable_name: `rt-${actorType}`,
      filter_subject: `inbound.${actorType}.>`,
    });
  }

  const handlers = createHandlers(appDef);
  consumerManager = new ConsumerManager(js, nc, handlers);
  await consumerManager.start(actorTypes);

  currentActorTypes = actorTypes;
  deployCount++;
  console.log(`[runtime] Deploy #${deployCount} complete`);

  return { actorTypes };
}

// ---------------------------------------------------------------------------
// Start API
// ---------------------------------------------------------------------------

await mkdir(BUNDLE_DIR, { recursive: true });

const api = createApi({
  async deploy(code) {
    const bundlePath = `${BUNDLE_DIR}/bundle-${Date.now()}.mjs`;
    await Bun.write(bundlePath, code);
    return deploy(bundlePath);
  },
  getStatus() {
    return { actorTypes: currentActorTypes, deployCount };
  },
});

api.listen(API_PORT);
console.log(`[runtime] Waiting for deploy on http://localhost:${API_PORT}`);
