export {};

import {
  defaultDevEnv,
  fail,
  openEscEnvironment,
  platformDir,
  withTemporaryDevVars,
} from "./platform-esc";

const firstArg = process.argv[2];

if (firstArg === "--help" || firstArg === "-h") {
  console.log(`Usage: bun run platform:dev [esc-environment]

Starts the platform locally with Vite hot reload and a temporary .dev.vars file
generated from the selected Pulumi ESC environment.

Default environment:
  ${defaultDevEnv}`);
  process.exit(0);
}

const envName =
  firstArg ||
  process.env.ZOCKET_PLATFORM_ENV ||
  defaultDevEnv;

const vars = await openEscEnvironment(envName);

if (!vars) {
  fail(`Unable to open Pulumi ESC environment ${envName}.`);
}

console.log(`Starting platform dev with ESC environment ${envName}`);

const code = await withTemporaryDevVars(vars, async () => {
  const proc = Bun.spawn(["bun", "run", "dev"], {
    cwd: platformDir,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      ...vars,
    },
  });

  return await proc.exited;
});

process.exit(code);
