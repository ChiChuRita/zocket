import * as path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const platformDir = `${rootDir}/platform`;
export const defaultDevEnv = "rahul-zocket-io/zocket/platform-dev";
export const defaultProdEnv = "rahul-zocket-io/zocket/platform-prod";

type EscOpenResult = {
  environmentVariables?: Record<string, string | undefined>;
};

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function serializeEnvRecord(record: Record<string, string | undefined>) {
  return `${Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n")}\n`;
}

export async function openEscEnvironment(envName: string) {
  const proc = Bun.spawn(["pulumi", "env", "open", envName], {
    cwd: rootDir,
    stdout: "pipe",
    stderr: "inherit",
  });

  const code = await proc.exited;
  if (code !== 0) {
    return null;
  }

  const output = await new Response(proc.stdout).text();
  const config = JSON.parse(output) as EscOpenResult;

  return config.environmentVariables ?? {};
}

export async function withTemporaryDevVars(
  vars: Record<string, string | undefined>,
  run: () => Promise<number>,
) {
  const devVarsPath = `${platformDir}/.dev.vars`;
  const existingFile = Bun.file(devVarsPath);
  const hadExistingFile = await existingFile.exists();
  const previousContent = hadExistingFile ? await existingFile.text() : null;

  await Bun.write(devVarsPath, serializeEnvRecord(vars));

  try {
    return await run();
  } finally {
    if (previousContent !== null) {
      await Bun.write(devVarsPath, previousContent);
    } else {
      await Bun.$`rm -f ${devVarsPath}`.quiet();
    }
  }
}
