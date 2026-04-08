const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? "http://localhost:3000";
const CONTROL_PLANE_INTERNAL_TOKEN =
  process.env.CONTROL_PLANE_INTERNAL_TOKEN ?? "zocket-internal-dev-token";

export async function authorizeProject(host: string, token: string | null) {
  const response = await fetch(`${CONTROL_PLANE_URL.replace(/\/$/, "")}/api/registry/authorize`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${CONTROL_PLANE_INTERNAL_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      host,
      token,
    }),
  });

  if (!response.ok) {
    let message = `Control plane responded ${response.status}`;
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Ignore JSON parse failure and use the status message.
    }
    throw new Error(message);
  }

  return await response.json() as {
    workspaceId: string;
    projectId: string;
    userId: string | null;
    claims: Record<string, unknown>;
  };
}
