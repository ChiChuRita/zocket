const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? "http://localhost:3000";
const CONTROL_PLANE_INTERNAL_TOKEN =
  process.env.CONTROL_PLANE_INTERNAL_TOKEN ?? "zocket-internal-dev-token";

function authorizedHeaders() {
  return {
    "authorization": `Bearer ${CONTROL_PLANE_INTERNAL_TOKEN}`,
    "content-type": "application/json",
  };
}

export async function fetchDeploymentBundle(args: {
  workspaceId: string;
  projectId: string;
  deploymentId: string;
}): Promise<{ code: string; deploymentId: string }> {
  const params = new URLSearchParams({
    workspaceId: args.workspaceId,
    projectId: args.projectId,
    deploymentId: args.deploymentId,
  });

  const response = await fetch(
    `${CONTROL_PLANE_URL.replace(/\/$/, "")}/api/internal/runtime/active?${params.toString()}`,
    {
      headers: authorizedHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Control plane responded ${response.status}`);
  }

  const payload = await response.json() as { code?: string; deploymentId?: string };

  if (!payload.code || !payload.deploymentId) {
    throw new Error("Control plane did not return a deployment bundle");
  }

  return {
    code: payload.code,
    deploymentId: payload.deploymentId,
  };
}

export async function reportRuntimeStatus(args: {
  deploymentId: string;
  status: "ready" | "failed";
  actorTypes?: string[];
  message?: string;
}): Promise<void> {
  const response = await fetch(`${CONTROL_PLANE_URL.replace(/\/$/, "")}/api/internal/runtime/report`, {
    method: "POST",
    headers: authorizedHeaders(),
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    throw new Error(`Runtime status report responded ${response.status}`);
  }
}
