export {};

import {
  defaultDevEnv,
  defaultProdEnv,
  fail,
  openEscEnvironment,
  platformDir,
  serializeEnvRecord,
} from "./platform-esc";

const firstArg = process.argv[2];

if (firstArg === "--help" || firstArg === "-h") {
  console.log(`Usage: bun run platform:deploy [esc-environment]

Builds and deploys the platform with Wrangler using secrets resolved from
Pulumi ESC. Defaults to the prod environment and falls back to the dev
environment when prod does not exist yet.

Default prod environment:
  ${defaultProdEnv}

Fallback dev environment:
  ${defaultDevEnv}`);
  process.exit(0);
}

const envName =
  firstArg ||
  process.env.ZOCKET_PLATFORM_ENV ||
  defaultProdEnv;

const requiredSecrets = [
  "DATABASE_URL",
  "WORKOS_API_KEY",
  "WORKOS_COOKIE_PASSWORD",
  "CONTROL_PLANE_INTERNAL_TOKEN",
] as const;

let resolvedEnv = envName;
let vars = await openEscEnvironment(envName);

if (!vars && envName === defaultProdEnv) {
  console.warn(
    `Pulumi ESC environment ${defaultProdEnv} was not found. Falling back to ${defaultDevEnv}.`,
  );
  resolvedEnv = defaultDevEnv;
  vars = await openEscEnvironment(defaultDevEnv);

  if (!vars) {
    fail(`Unable to open Pulumi ESC environment ${defaultDevEnv}.`);
  }
} else if (!vars) {
  fail(`Unable to open Pulumi ESC environment ${envName}.`);
}

const missing = requiredSecrets.filter((key) => !vars[key]);

if (missing.length) {
  fail(`Missing required platform secrets in ESC: ${missing.join(", ")}`);
}

console.log(`Deploying platform with ESC environment ${resolvedEnv}`);

const secretsFile = `/tmp/zocket-platform-secrets-${Date.now()}.env`;

const secretVars = Object.fromEntries(
  requiredSecrets.map((key) => [key, vars[key]]),
);

await Bun.write(secretsFile, serializeEnvRecord(secretVars));

try {
  const deploy = Bun.spawn(
    ["bun", "run", "build"],
    {
      cwd: platformDir,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        ...vars,
      },
    },
  );

  const buildCode = await deploy.exited;
  if (buildCode !== 0) {
    process.exit(buildCode);
  }

  const push = Bun.spawn(
    ["bun", "run", "deploy", "--", "--secrets-file", secretsFile],
    {
      cwd: platformDir,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        ...vars,
      },
    },
  );

  const pushCode = await push.exited;
  process.exit(pushCode);
} finally {
  await Bun.$`rm -f ${secretsFile}`.quiet();
}
