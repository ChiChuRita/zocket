import { Elysia, t } from "elysia";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { jwtVerify, createRemoteJWKSet } from "jose";
import {
  cliTokens,
  deployTokens,
  deployments,
  deviceFlows,
  getDb,
  projectAuthConfigs,
  projects,
  runtimeConfigs,
  users,
  workspaceMemberships,
  workspaces,
} from "../db";
import { ensureProjectRuntime } from "../deploy";
import { createId, createUserCode, domainSuffix, hashToken, slugify, stackNameForProject } from "../helpers";
import { getBundle, putBundle } from "../s3";

type BrowserIdentity = {
  workosUserId: string;
  email: string;
  name: string;
};

type AuthContext = {
  user: typeof users.$inferSelect;
  workspace: typeof workspaces.$inferSelect;
  mode: "browser" | "cli";
};

function getInternalToken() {
  return process.env.CONTROL_PLANE_INTERNAL_TOKEN ?? "zocket-internal-dev-token";
}

function getBrowserIdentity(headers: Headers): BrowserIdentity | null {
  const workosUserId = headers.get("x-zocket-workos-user-id");
  const email = headers.get("x-zocket-workos-user-email");
  if (!workosUserId || !email) {
    return null;
  }

  return {
    workosUserId,
    email,
    name:
      headers.get("x-zocket-workos-user-name") ??
      email.split("@")[0] ??
      "User",
  };
}

async function ensureUserWorkspace(identity: BrowserIdentity) {
  const db = getDb();
  const normalizedEmail = identity.email.trim().toLowerCase();
  const nextName = identity.name.trim() || normalizedEmail.split("@")[0] || "User";

  return await db.transaction(async (tx) => {
    let user =
      (await tx.query.users.findFirst({
        where: eq(users.workosUserId, identity.workosUserId),
      })) ??
      (await tx.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
      })) ??
      null;

    if (!user) {
      const userId = createId("usr");
      const workspaceId = createId("ws");
      const baseSlug = slugify(normalizedEmail.split("@")[0] ?? "workspace");
      let workspaceSlug = baseSlug;
      let suffix = 2;

      while (
        await tx.query.workspaces.findFirst({
          where: eq(workspaces.slug, workspaceSlug),
        })
      ) {
        workspaceSlug = `${baseSlug}-${suffix++}`;
      }

      user = (
        await tx
          .insert(users)
          .values({
            id: userId,
            workosUserId: identity.workosUserId,
            email: normalizedEmail,
            name: nextName,
          })
          .returning()
      )[0]!;

      const workspace = (
        await tx
          .insert(workspaces)
          .values({
            id: workspaceId,
            name: `${nextName}'s Workspace`,
            slug: workspaceSlug,
            ownerUserId: user.id,
          })
          .returning()
      )[0]!;

      await tx.insert(workspaceMemberships).values({
        id: createId("wm"),
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
      });

      return { user, workspace };
    }

    if (
      user.email !== normalizedEmail ||
      user.name !== nextName ||
      user.workosUserId !== identity.workosUserId
    ) {
      user = (
        await tx
          .update(users)
          .set({
            email: normalizedEmail,
            name: nextName,
            workosUserId: identity.workosUserId,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .returning()
      )[0]!;
    }

    let membership = await tx.query.workspaceMemberships.findFirst({
      where: eq(workspaceMemberships.userId, user.id),
      orderBy: asc(workspaceMemberships.createdAt),
    });

    let workspace =
      membership
        ? await tx.query.workspaces.findFirst({
            where: eq(workspaces.id, membership.workspaceId),
          })
        : null;

    if (!workspace) {
      const workspaceId = createId("ws");
      const baseSlug = slugify(normalizedEmail.split("@")[0] ?? "workspace");
      let workspaceSlug = baseSlug;
      let suffix = 2;

      while (
        await tx.query.workspaces.findFirst({
          where: eq(workspaces.slug, workspaceSlug),
        })
      ) {
        workspaceSlug = `${baseSlug}-${suffix++}`;
      }

      workspace = (
        await tx
          .insert(workspaces)
          .values({
            id: workspaceId,
            name: `${nextName}'s Workspace`,
            slug: workspaceSlug,
            ownerUserId: user.id,
          })
          .returning()
      )[0]!;

      membership = (
        await tx
          .insert(workspaceMemberships)
          .values({
            id: createId("wm"),
            workspaceId: workspace.id,
            userId: user.id,
            role: "owner",
          })
          .returning()
      )[0]!;
    }

    return { user, workspace };
  });
}

async function requireUserContext(headers: Headers): Promise<AuthContext> {
  const browserIdentity = getBrowserIdentity(headers);
  if (browserIdentity) {
    const { user, workspace } = await ensureUserWorkspace(browserIdentity);
    return { user, workspace, mode: "browser" };
  }

  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.slice("Bearer ".length);
  if (token === getInternalToken()) {
    throw new Error("Unauthorized");
  }

  const db = getDb();
  const cliToken = await db.query.cliTokens.findFirst({
    where: and(
      eq(cliTokens.tokenHash, await hashToken(token)),
      isNull(cliTokens.revokedAt),
      sql`${cliTokens.expiresAt} > now()`,
    ),
  });

  if (!cliToken) {
    throw new Error("Unauthorized");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, cliToken.userId),
  });
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, cliToken.workspaceId),
  });

  if (!user || !workspace) {
    throw new Error("Unauthorized");
  }

  return { user, workspace, mode: "cli" };
}

async function requireInternal(headers: Headers) {
  const authHeader = headers.get("authorization");
  if (authHeader !== `Bearer ${getInternalToken()}`) {
    throw new Error("Unauthorized");
  }
}

async function loadProjectSummary(projectId: string) {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const [workspace, activeDeployment, authConfig, runtimeConfig] = await Promise.all([
    db.query.workspaces.findFirst({ where: eq(workspaces.id, project.workspaceId) }),
    project.activeDeploymentId
      ? db.query.deployments.findFirst({ where: eq(deployments.id, project.activeDeploymentId) })
      : Promise.resolve(null),
    db.query.projectAuthConfigs.findFirst({ where: eq(projectAuthConfigs.projectId, project.id) }),
    db.query.runtimeConfigs.findFirst({ where: eq(runtimeConfigs.projectId, project.id) }),
  ]);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  return {
    workspace,
    project,
    activeDeployment,
    authConfig,
    runtimeConfig,
  };
}

async function ensureProjectOwnedByWorkspace(projectId: string, workspaceId: string) {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return project;
}

async function resolveProjectBySlug(slug: string, workspaceId: string) {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), eq(projects.workspaceId, workspaceId)),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return await loadProjectSummary(project.id);
}

async function nextProjectSlug(baseInput: string) {
  const db = getDb();
  const baseSlug = slugify(baseInput);
  let candidate = baseSlug;
  let suffix = 2;

  while (await db.query.projects.findFirst({ where: eq(projects.slug, candidate) })) {
    candidate = `${baseSlug}-${suffix++}`;
  }

  return candidate;
}

async function createProjectForWorkspace(
  auth: AuthContext,
  input: { name: string; slug?: string },
) {
  const db = getDb();
  const projectId = createId("prj");
  const slug = await nextProjectSlug(input.slug || input.name);
  const domain = `${slug}.${domainSuffix()}`;

  const result = await db.transaction(async (tx) => {
    const project = (
      await tx
        .insert(projects)
        .values({
          id: projectId,
          workspaceId: auth.workspace.id,
          name: input.name.trim(),
          slug,
          domain,
        })
        .returning()
    )[0]!;

    const authConfig = (
      await tx
        .insert(projectAuthConfigs)
        .values({
          id: createId("auth"),
          projectId,
          mode: "none",
        })
        .returning()
    )[0]!;

    const runtimeConfig = (
      await tx
        .insert(runtimeConfigs)
        .values({
          id: createId("rt"),
          projectId,
          workspaceId: auth.workspace.id,
          desiredStatus: "idle",
        })
        .returning()
    )[0]!;

    const token = `zkt_${createId("tok")}`;
    await tx.insert(deployTokens).values({
      id: createId("dpltok"),
      projectId,
      name: "Default deploy token",
      tokenHash: await hashToken(token),
    });

    return {
      summary: {
        workspace: auth.workspace,
        project,
        activeDeployment: null,
        authConfig,
        runtimeConfig,
      },
      deployToken: token,
    };
  });

  return result;
}

async function createDeployTokenForProject(
  auth: AuthContext,
  projectId: string,
  name: string,
) {
  await ensureProjectOwnedByWorkspace(projectId, auth.workspace.id);
  const db = getDb();
  const token = `zkt_${createId("tok")}`;
  const record = (
    await db
      .insert(deployTokens)
      .values({
        id: createId("dpltok"),
        projectId,
        name,
        tokenHash: await hashToken(token),
      })
      .returning()
  )[0]!;

  return { deployToken: record, token };
}

async function revokeDeployTokenForProject(
  auth: AuthContext,
  projectId: string,
  tokenId: string,
) {
  await ensureProjectOwnedByWorkspace(projectId, auth.workspace.id);
  const db = getDb();
  const deployToken = await db.query.deployTokens.findFirst({
    where: and(eq(deployTokens.id, tokenId), eq(deployTokens.projectId, projectId)),
  });

  if (!deployToken) {
    throw new Error("Deploy token not found");
  }

  await db
    .update(deployTokens)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(deployTokens.id, deployToken.id));

  return { ok: true as const };
}

async function listProjectsForWorkspace(auth: AuthContext) {
  const db = getDb();
  const rows = await db.query.projects.findMany({
    where: eq(projects.workspaceId, auth.workspace.id),
    orderBy: desc(projects.createdAt),
  });

  const summaries = await Promise.all(rows.map((project) => loadProjectSummary(project.id)));
  return {
    workspace: auth.workspace,
    projects: summaries,
  };
}

async function issueCliToken(userId: string, workspaceId: string) {
  const db = getDb();
  const rawToken = `zcli_${createId("cli")}`;
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await db.insert(cliTokens).values({
    id: createId("clitok"),
    userId,
    workspaceId,
    tokenHash,
    expiresAt,
  });

  return { rawToken, tokenHash, expiresAt };
}

async function createDeploymentFromToken(args: {
  deployToken: string;
  code: string;
  entry: string;
}) {
  const db = getDb();
  const tokenHash = await hashToken(args.deployToken);
  const tokenRecord = await db.query.deployTokens.findFirst({
    where: and(eq(deployTokens.tokenHash, tokenHash), isNull(deployTokens.revokedAt)),
  });

  if (!tokenRecord) {
    throw new Error("Invalid deploy token");
  }

  const projectSummary = await loadProjectSummary(tokenRecord.projectId);
  const projectDeployments = await db.query.deployments.findMany({
    where: eq(deployments.projectId, projectSummary.project.id),
    orderBy: desc(deployments.createdAt),
  });
  const version = String(projectDeployments.length + 1);
  const deploymentId = createId("dep");
  const bundleKey = `projects/${projectSummary.project.id}/deployments/${deploymentId}/${args.entry}`;

  await putBundle(bundleKey, args.code);

  let deployment = (
    await db
      .insert(deployments)
      .values({
        id: deploymentId,
        projectId: projectSummary.project.id,
        version,
        bundleKey,
        status: "stored",
        actorTypes: [],
      })
      .returning()
  )[0]!;

  await db
    .update(projects)
    .set({
      activeDeploymentId: deployment.id,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectSummary.project.id));

  void ensureProjectRuntime({
    deploymentId: deployment.id,
    workspaceId: projectSummary.workspace.id,
    projectId: projectSummary.project.id,
    stackName: stackNameForProject(projectSummary.workspace.id, projectSummary.project.id),
    desiredStatus: (projectSummary.runtimeConfig?.desiredStatus as "idle" | "active" | null) ?? "active",
  }).catch(async (error: any) => {
    console.error(`[deploy:${projectSummary.project.id}]`, error);
    await db
      .update(deployments)
      .set({
        status: "failed",
        runtimeMessage: error?.message ?? "Deployment trigger failed",
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deployment.id));
  });

  return {
    deployment,
    project: projectSummary.project,
    workspace: projectSummary.workspace,
    websocketUrl: `wss://${projectSummary.project.domain}`,
  };
}

async function resolveProjectForGateway(host: string, token: string | null) {
  const db = getDb();
  const normalizedHost = host.toLowerCase().split(":")[0]!;
  const project = await db.query.projects.findFirst({
    where: eq(projects.domain, normalizedHost),
  });

  if (!project) {
    throw new Error("Unknown project host");
  }

  const authConfig = await db.query.projectAuthConfigs.findFirst({
    where: eq(projectAuthConfigs.projectId, project.id),
  });

  if (!authConfig || authConfig.mode === "none") {
    return {
      workspaceId: project.workspaceId,
      projectId: project.id,
      userId: null,
      claims: {},
    };
  }

  if (!token) {
    throw new Error("Missing auth token");
  }

  if (authConfig.mode === "jwt-secret") {
    if (!authConfig.jwtSecret) {
      throw new Error("Missing project JWT secret");
    }

    const payload = await jwtVerify(token, new TextEncoder().encode(authConfig.jwtSecret), {
      issuer: authConfig.issuer ?? undefined,
      audience: authConfig.audience ?? undefined,
    });

    return {
      workspaceId: project.workspaceId,
      projectId: project.id,
      userId: typeof payload.payload.sub === "string" ? payload.payload.sub : null,
      claims: payload.payload as Record<string, unknown>,
    };
  }

  if (!authConfig.jwksUrl) {
    throw new Error("Missing project JWKS URL");
  }

  const payload = await jwtVerify(
    token,
    createRemoteJWKSet(new URL(authConfig.jwksUrl)),
    {
      issuer: authConfig.issuer ?? undefined,
      audience: authConfig.audience ?? undefined,
    },
  );

  return {
    workspaceId: project.workspaceId,
    projectId: project.id,
    userId: typeof payload.payload.sub === "string" ? payload.payload.sub : null,
    claims: payload.payload as Record<string, unknown>,
  };
}

export const app = new Elysia({
  prefix: "/api",
  aot: false,
})
  .onError(({ code, error, set }) => {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "API request failed";

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: message,
      };
    }

    set.status = message === "Unauthorized" ? 401 : 400;
    return {
      error: message,
    };
  })
  .get("/health", () => ({
    ok: true as const,
  }))
  .post(
    "/auth/device/start",
    async ({ request }) => {
      const origin = new URL(request.url).origin;
      const verificationUri = `${origin}/verify`;
      const deviceFlow = {
        id: createId("df"),
        deviceCode: crypto.randomUUID(),
        userCode: createUserCode(),
        verificationUri,
        status: "pending",
      };

      await getDb().insert(deviceFlows).values(deviceFlow);

      return {
        ...deviceFlow,
        verificationUriComplete: `${verificationUri}?deviceCode=${encodeURIComponent(deviceFlow.deviceCode)}`,
        intervalSeconds: 2,
      };
    },
  )
  .get(
    "/auth/device/:deviceCode",
    async ({ params }) => {
      const flow = await getDb().query.deviceFlows.findFirst({
        where: eq(deviceFlows.deviceCode, params.deviceCode),
      });

      if (!flow) {
        return { status: "not_found" as const };
      }

      if (flow.status !== "approved" || !flow.approvedUserId) {
        return {
          status: flow.status as "pending" | "approved",
          userCode: flow.userCode,
          cliToken: null,
        };
      }

      const membership = await getDb().query.workspaceMemberships.findFirst({
        where: eq(workspaceMemberships.userId, flow.approvedUserId),
        orderBy: asc(workspaceMemberships.createdAt),
      });

      if (!membership) {
        throw new Error("Approved user has no workspace");
      }

      const cliToken = await issueCliToken(flow.approvedUserId, membership.workspaceId);
      await getDb()
        .update(deviceFlows)
        .set({
          issuedCliTokenHash: cliToken.tokenHash,
          updatedAt: new Date(),
        })
        .where(eq(deviceFlows.id, flow.id));

      return {
        status: "approved" as const,
        userCode: flow.userCode,
        cliToken: cliToken.rawToken,
      };
    },
    {
      params: t.Object({
        deviceCode: t.String(),
      }),
    },
  )
  .post(
    "/auth/device/:deviceCode/approve",
    async ({ params, request }) => {
      const auth = await requireUserContext(request.headers);
      const flow = await getDb().query.deviceFlows.findFirst({
        where: eq(deviceFlows.deviceCode, params.deviceCode),
      });

      if (!flow) {
        throw new Error("Unknown device code");
      }

      await getDb()
        .update(deviceFlows)
        .set({
          status: "approved",
          approvedUserId: auth.user.id,
          updatedAt: new Date(),
        })
        .where(eq(deviceFlows.id, flow.id));

      return {
        status: "approved" as const,
        userCode: flow.userCode,
      };
    },
    {
      params: t.Object({
        deviceCode: t.String(),
      }),
    },
  )
  .get("/projects", async ({ request }) => {
    const auth = await requireUserContext(request.headers);
    return await listProjectsForWorkspace(auth);
  })
  .post(
    "/projects",
    async ({ body, request }) => {
      const auth = await requireUserContext(request.headers);
      return await createProjectForWorkspace(auth, body);
    },
    {
      body: t.Object({
        name: t.String(),
        slug: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/projects/:slug",
    async ({ params, request }) => {
      const auth = await requireUserContext(request.headers);
      return await resolveProjectBySlug(params.slug, auth.workspace.id);
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
    },
  )
  .get(
    "/project-slugs/:slug",
    async ({ params, request }) => {
      const auth = await requireUserContext(request.headers);
      return await resolveProjectBySlug(params.slug, auth.workspace.id);
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
    },
  )
  .post(
    "/projects/:projectId/deploy-tokens",
    async ({ params, body, request }) => {
      const auth = await requireUserContext(request.headers);
      return await createDeployTokenForProject(auth, params.projectId, body.name);
    },
    {
      params: t.Object({
        projectId: t.String(),
      }),
      body: t.Object({
        name: t.String(),
      }),
    },
  )
  .post(
    "/project-ids/:projectId/deploy-tokens",
    async ({ params, body, request }) => {
      const auth = await requireUserContext(request.headers);
      return await createDeployTokenForProject(auth, params.projectId, body.name);
    },
    {
      params: t.Object({
        projectId: t.String(),
      }),
      body: t.Object({
        name: t.String(),
      }),
    },
  )
  .post(
    "/projects/:projectId/deploy-tokens/:tokenId/revoke",
    async ({ params, request }) => {
      const auth = await requireUserContext(request.headers);
      return await revokeDeployTokenForProject(auth, params.projectId, params.tokenId);
    },
    {
      params: t.Object({
        projectId: t.String(),
        tokenId: t.String(),
      }),
    },
  )
  .post(
    "/project-ids/:projectId/deploy-tokens/:tokenId/revoke",
    async ({ params, request }) => {
      const auth = await requireUserContext(request.headers);
      return await revokeDeployTokenForProject(auth, params.projectId, params.tokenId);
    },
    {
      params: t.Object({
        projectId: t.String(),
        tokenId: t.String(),
      }),
    },
  )
  .post(
    "/deployments",
    async ({ body }) => {
      return await createDeploymentFromToken(body);
    },
    {
      body: t.Object({
        deployToken: t.String(),
        code: t.String(),
        entry: t.String(),
      }),
    },
  )
  .post(
    "/registry/authorize",
    async ({ body, request }) => {
      await requireInternal(request.headers);
      return await resolveProjectForGateway(body.host, body.token ?? null);
    },
    {
      body: t.Object({
        host: t.String(),
        token: t.Optional(t.Nullable(t.String())),
      }),
    },
  )
  .get(
    "/internal/runtime/active",
    async ({ query, request }) => {
      await requireInternal(request.headers);
      const deployment = await getDb().query.deployments.findFirst({
        where: and(
          eq(deployments.id, query.deploymentId),
          eq(deployments.projectId, query.projectId),
        ),
      });

      const project = await getDb().query.projects.findFirst({
        where: and(eq(projects.id, query.projectId), eq(projects.workspaceId, query.workspaceId)),
      });

      if (!deployment || !project) {
        throw new Error("Deployment not found");
      }

      return {
        deploymentId: deployment.id,
        code: await getBundle(deployment.bundleKey),
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        projectId: t.String(),
        deploymentId: t.String(),
      }),
    },
  )
  .post(
    "/internal/runtime/report",
    async ({ body, request }) => {
      await requireInternal(request.headers);

      if (body.status === "ready") {
        await getDb()
          .update(deployments)
          .set({
            status: "deployed",
            actorTypes: body.actorTypes ?? [],
            runtimeMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(deployments.id, body.deploymentId));

        return { ok: true as const };
      }

      await getDb()
        .update(deployments)
        .set({
          status: "failed",
          runtimeMessage: body.message ?? "Runtime failed to load deployment",
          updatedAt: new Date(),
        })
        .where(eq(deployments.id, body.deploymentId));

      return { ok: true as const };
    },
    {
      body: t.Object({
        deploymentId: t.String(),
        status: t.Union([t.Literal("ready"), t.Literal("failed")]),
        actorTypes: t.Optional(t.Array(t.String())),
        message: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/internal/deployments/report",
    async ({ body, request }) => {
      await requireInternal(request.headers);

      if (body.status === "deploying") {
        await getDb()
          .update(deployments)
          .set({
            status: "stored",
            runtimeMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(deployments.id, body.deploymentId));

        return { ok: true as const };
      }

      await getDb()
        .update(deployments)
        .set({
          status: "failed",
          runtimeMessage: body.message ?? "Deployment failed",
          updatedAt: new Date(),
        })
        .where(eq(deployments.id, body.deploymentId));

      return { ok: true as const };
    },
    {
      body: t.Object({
        deploymentId: t.String(),
        status: t.Union([t.Literal("deploying"), t.Literal("failed")]),
        message: t.Optional(t.String()),
      }),
    },
  );

export type PlatformApi = typeof app;
