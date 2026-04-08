#!/usr/bin/env bun

import { basename, dirname, join, resolve } from "path";
import { cac } from "cac";
import { z } from "zod";

const DEFAULT_PLATFORM_URL = Bun.env.ZOCKET_PLATFORM_URL ?? "http://localhost:3000";
const HOME_DIR = Bun.env.HOME ?? Bun.env.USERPROFILE ?? ".";
const HOME_CONFIG_PATH = join(HOME_DIR, ".zocket", "config.json");
const PROJECT_CONFIG_NAME = ".zocket.json";

const deviceStartSchema = z.object({
  deviceCode: z.string(),
  userCode: z.string(),
  verificationUri: z.string().url(),
  verificationUriComplete: z.string().url(),
  intervalSeconds: z.number().int().positive(),
});

const devicePollSchema = z.union([
  z.object({
    status: z.literal("not_found"),
  }),
  z.object({
    status: z.union([z.literal("pending"), z.literal("approved")]),
    userCode: z.string(),
    cliToken: z.string().nullable(),
  }),
]);

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  domain: z.string(),
  activeDeploymentId: z.string().nullable().optional(),
});

const createProjectSchema = z.object({
  summary: z.object({
    project: projectSchema,
  }),
  deployToken: z.string(),
});

const getProjectSchema = z.object({
  project: projectSchema,
});

const createDeployTokenSchema = z.object({
  deployToken: z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
  }),
  token: z.string(),
});

const createDeploymentSchema = z.object({
  deployment: z.object({
    id: z.string(),
    version: z.string(),
    status: z.string(),
    actorTypes: z.array(z.string()).default([]),
    runtimeMessage: z.string().nullable().optional(),
  }),
  project: z.object({
    id: z.string(),
    slug: z.string(),
    domain: z.string(),
  }),
  websocketUrl: z.string(),
});

type CliConfig = {
  platformUrl: string;
  cliToken?: string;
  userToken?: string;
};

type ProjectLink = {
  projectId: string;
  projectSlug: string;
  projectDomain: string;
  deployToken: string;
  entry: string;
};

type SharedOptions = {
  platformUrl?: string;
};

type InitOptions = SharedOptions & {
  name?: string;
  slug?: string;
  entry?: string;
};

type LinkOptions = SharedOptions & {
  project?: string;
  entry?: string;
};

type DeployOptions = SharedOptions & {
  entry?: string;
};

const globalConfig = await readJson<CliConfig>(HOME_CONFIG_PATH, {
  platformUrl: DEFAULT_PLATFORM_URL,
});

const cli = cac("zocket");

cli
  .command("auth", "Sign in through the platform device flow")
  .option("--platform-url <url>", "Override the control-plane API URL")
  .action(async (options: SharedOptions) => {
    await handleAuth(options);
  });

cli
  .command("init", "Create a project and link the current directory")
  .option("--platform-url <url>", "Override the control-plane API URL")
  .option("--name <name>", "Project name")
  .option("--slug <slug>", "Optional project slug")
  .option("--entry <file>", "Entry point file", {
    default: "index.ts",
  })
  .action(async (options: InitOptions) => {
    await handleInit(options);
  });

cli
  .command("link", "Link the current directory to an existing project")
  .option("--platform-url <url>", "Override the control-plane API URL")
  .option("--project <slug>", "Existing project slug")
  .option("--entry <file>", "Entry point file", {
    default: "index.ts",
  })
  .action(async (options: LinkOptions) => {
    await handleLink(options);
  });

cli
  .command("deploy", "Bundle and deploy the linked project")
  .option("--platform-url <url>", "Override the control-plane API URL")
  .option("--entry <file>", "Entry point file")
  .action(async (options: DeployOptions) => {
    await handleDeploy(options);
  });

cli.help();

try {
  cli.parse(Bun.argv);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function getPlatformUrl(options?: SharedOptions): string {
  return (options?.platformUrl ?? globalConfig.platformUrl).replace(/\/$/, "");
}

function requireCliToken(): string {
  const token = globalConfig.cliToken ?? globalConfig.userToken;
  if (!token) {
    console.error("Run `zocket auth` first.");
    process.exit(1);
  }
  return token;
}

async function handleAuth(options: SharedOptions): Promise<void> {
  const platformUrl = getPlatformUrl(options);
  const data = await requestJson(
    platformUrl,
    "/api/auth/device/start",
    { method: "POST" },
    deviceStartSchema,
  );

  console.log(`Open ${data.verificationUriComplete}`);
  console.log(`User code: ${data.userCode}`);
  await tryOpenBrowser(data.verificationUriComplete);

  while (true) {
    await Bun.sleep(data.intervalSeconds * 1000);
    const poll = await requestJson(
      platformUrl,
      `/api/auth/device/${encodeURIComponent(data.deviceCode)}`,
      { method: "GET" },
      devicePollSchema,
    );

    if (poll.status === "not_found") {
      throw new Error("Device flow expired or was not found");
    }

    if (poll.status === "approved" && poll.cliToken) {
      await writeJson(HOME_CONFIG_PATH, {
        ...globalConfig,
        platformUrl,
        cliToken: poll.cliToken,
      });
      console.log("Authenticated successfully.");
      return;
    }
  }
}

async function handleInit(options: InitOptions): Promise<void> {
  const cliToken = requireCliToken();
  const name = options.name;
  const slug = options.slug;
  const entry = options.entry ?? "index.ts";

  if (!name) {
    console.error("`zocket init` requires `--name`.");
    process.exit(1);
  }

  const platformUrl = getPlatformUrl(options);
  const data = await requestJson(
    platformUrl,
    "/api/projects",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${cliToken}`,
      },
      body: JSON.stringify({
        name,
        slug,
      }),
    },
    createProjectSchema,
  );

  const link: ProjectLink = {
    projectId: data.summary.project.id,
    projectSlug: data.summary.project.slug,
    projectDomain: data.summary.project.domain,
    deployToken: data.deployToken,
    entry,
  };

  await writeJson(resolve(process.cwd(), PROJECT_CONFIG_NAME), link);
  console.log(`Linked current directory to ${link.projectSlug}`);
  console.log(`WebSocket URL: wss://${link.projectDomain}`);
}

async function handleLink(options: LinkOptions): Promise<void> {
  const cliToken = requireCliToken();
  const slug = options.project;
  const entry = options.entry ?? "index.ts";

  if (!slug) {
    console.error("`zocket link` requires `--project <slug>`.");
    process.exit(1);
  }

  const platformUrl = getPlatformUrl(options);
  const projectResponse = await requestJson(
    platformUrl,
    `/api/projects/${encodeURIComponent(slug)}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${cliToken}`,
      },
    },
    getProjectSchema,
  );

  const tokenResponse = await requestJson(
    platformUrl,
    `/api/projects/${encodeURIComponent(projectResponse.project.id)}/deploy-tokens`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${cliToken}`,
      },
      body: JSON.stringify({
        name: `CLI token ${new Date().toISOString()}`,
      }),
    },
    createDeployTokenSchema,
  );

  const link: ProjectLink = {
    projectId: projectResponse.project.id,
    projectSlug: projectResponse.project.slug,
    projectDomain: projectResponse.project.domain,
    deployToken: tokenResponse.token,
    entry,
  };

  await writeJson(resolve(process.cwd(), PROJECT_CONFIG_NAME), link);
  console.log(`Linked current directory to ${link.projectSlug}`);
  console.log(`WebSocket URL: wss://${link.projectDomain}`);
}

async function handleDeploy(options: DeployOptions): Promise<void> {
  const link = await readJson<ProjectLink | null>(resolve(process.cwd(), PROJECT_CONFIG_NAME), null);
  if (!link) {
    console.error("Current directory is not linked. Run `zocket init` or `zocket link`.");
    process.exit(1);
  }

  const entry = options.entry ?? link.entry ?? "index.ts";
  const entryPath = resolve(process.cwd(), entry);

  console.log(`Bundling ${basename(entryPath)}...`);
  const result = await Bun.build({
    entrypoints: [entryPath],
    target: "bun",
    format: "esm",
  });

  if (!result.success || !result.outputs[0]) {
    console.error("Bundle failed:");
    for (const log of result.logs) {
      console.error(" ", log);
    }
    process.exit(1);
  }

  const code = await result.outputs[0].text();
  console.log(`Bundle ready (${(code.length / 1024).toFixed(1)} KB)`);

  const data = await requestJson(
    getPlatformUrl(options),
    "/api/deployments",
    {
      method: "POST",
      body: JSON.stringify({
        deployToken: link.deployToken,
        code,
        entry,
      }),
    },
    createDeploymentSchema,
  );

  console.log(`Deployment #${data.deployment.version} ${data.deployment.status} for ${data.project.slug}`);
  console.log(`Domain: ${data.project.domain}`);
  console.log(`WebSocket URL: ${data.websocketUrl}`);
  if (data.deployment.actorTypes.length > 0) {
    console.log(`Actor types: ${data.deployment.actorTypes.join(", ")}`);
  }
  if (data.deployment.runtimeMessage) {
    console.log(`Runtime: ${data.deployment.runtimeMessage}`);
  }
}

async function requestJson<T>(
  platformUrl: string,
  pathname: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${platformUrl}${pathname}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return schema.parse(payload);
}

async function tryOpenBrowser(url: string): Promise<void> {
  const commands =
    Bun.platform === "darwin"
      ? [["open", url]]
      : Bun.platform === "win32"
        ? [["cmd", "/c", "start", url]]
        : [["xdg-open", url]];

  for (const cmd of commands) {
    try {
      const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
      await proc.exited;
      return;
    } catch {
      // Ignore and fall back to printing the URL.
    }
  }
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return await Bun.file(path).json() as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await Bun.$`mkdir -p ${dirname(path)}`.quiet();
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
}
