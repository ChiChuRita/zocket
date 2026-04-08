import { connect } from "nats";
import { createHandlers } from "@zocket/server";
import { ensureStreams, ensureConsumer, INBOUND_STREAM } from "@zocket/nats-transport";
import type { AppDef } from "@zocket/core";
import { ConsumerManager } from "./consumer";
import { createApi } from "./api";
import { mkdir } from "node:fs/promises";
import { fetchDeploymentBundle, reportRuntimeStatus } from "./control-plane";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";
const API_PORT = parseInt(process.env.API_PORT ?? "8080", 10);
const BUNDLE_DIR = process.env.BUNDLE_DIR ?? "/app/bundles";
const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? "http://localhost:3000";
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;
const WORKSPACE_ID = process.env.WORKSPACE_ID ?? "local-workspace";
const PROJECT_ID = process.env.PROJECT_ID ?? "local-project";

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

let consumerManager: ConsumerManager | null = null;
let currentActorTypes: string[] = [];
let deployCount = 0;
let currentDeploymentId: string | null = null;

// ---------------------------------------------------------------------------
// Connect to NATS + load active bundle
// ---------------------------------------------------------------------------

if (!DEPLOYMENT_ID) {
  throw new Error("DEPLOYMENT_ID is required");
}
let nc: Awaited<ReturnType<typeof connect>>;
let jsm: Awaited<ReturnType<Awaited<ReturnType<typeof connect>>["jetstreamManager"]>>;
let js: ReturnType<Awaited<ReturnType<typeof connect>>["jetstream"]>;

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
      durable_name: `rt-${WORKSPACE_ID}-${PROJECT_ID}-${actorType}`,
      filter_subject: `inbound.${WORKSPACE_ID}.${PROJECT_ID}.${actorType}.>`,
    });
  }

  const handlers = createHandlers(appDef);
  consumerManager = new ConsumerManager(js, nc, handlers, {
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
  });
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

try {
  const pendingDeployment = await fetchDeploymentBundle({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    deploymentId: DEPLOYMENT_ID,
  });

  console.log(`[runtime] Connecting to NATS at ${NATS_URL}`);
  nc = await connect({
    servers: NATS_URL,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 1000,
  });
  console.log("[runtime] Connected to NATS");

  jsm = await nc.jetstreamManager();
  js = nc.jetstream();
  await ensureStreams(jsm);

  const bundlePath = `${BUNDLE_DIR}/bundle-${Date.now()}.mjs`;
  await Bun.write(bundlePath, pendingDeployment.code);
  const result = await deploy(bundlePath);
  currentDeploymentId = pendingDeployment.deploymentId;

  await reportRuntimeStatus({
    deploymentId: pendingDeployment.deploymentId,
    status: "ready",
    actorTypes: result.actorTypes,
  });

  const api = createApi({
    getStatus() {
      return {
        deploymentId: currentDeploymentId,
        actorTypes: currentActorTypes,
        deployCount,
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
      };
    },
  });

  api.listen(API_PORT);
  console.log(
    `[runtime] Loaded deployment ${currentDeploymentId} from ${CONTROL_PLANE_URL} and listening on http://localhost:${API_PORT}`,
  );
} catch (error: any) {
  console.error("[runtime] Failed to boot deployment:", error);
  try {
    await reportRuntimeStatus({
      deploymentId: DEPLOYMENT_ID,
      status: "failed",
      message: error?.message ?? "Runtime failed to boot deployment",
    });
  } catch (reportError) {
    console.error("[runtime] Failed to report runtime failure:", reportError);
  }
  process.exit(1);
}
