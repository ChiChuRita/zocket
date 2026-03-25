#!/usr/bin/env bun

import { resolve, basename } from "node:path";
import { treaty } from "@elysiajs/eden";
import type { RuntimeApi } from "@zocket/runtime/api";

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  printUsage();
  process.exit(0);
}

if (command !== "deploy") {
  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

function printUsage() {
  console.log(`
Usage: zocket <command> [options]

Commands:
  deploy    Bundle and deploy actors to the runtime

Deploy options:
  --url <url>       Runtime API URL (default: http://localhost:8080)
  --entry <file>    Entry point file (default: index.ts)
  `);
}

// ---------------------------------------------------------------------------
// Parse deploy flags
// ---------------------------------------------------------------------------

let url = "http://localhost:8080";
let entry = "index.ts";

for (let i = 1; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) {
    url = args[++i];
  } else if (args[i] === "--entry" && args[i + 1]) {
    entry = args[++i];
  } else if (!args[i].startsWith("--")) {
    entry = args[i];
  }
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

const entryPath = resolve(process.cwd(), entry);

console.log(`Bundling ${basename(entryPath)}...`);

const result = await Bun.build({
  entrypoints: [entryPath],
  target: "bun",
  format: "esm",
});

if (!result.success) {
  console.error("Bundle failed:");
  for (const log of result.logs) {
    console.error(" ", log);
  }
  process.exit(1);
}

const code = await result.outputs[0].text();
console.log(`Bundle ready (${(code.length / 1024).toFixed(1)} KB)`);

// ---------------------------------------------------------------------------
// Deploy via Eden Treaty (type-safe)
// ---------------------------------------------------------------------------

const api = treaty<RuntimeApi>(url);

console.log(`Deploying to ${url}...`);

const { data, error } = await api.deploy.post({ code });

if (error) {
  console.error(`Deploy failed: ${error.value}`);
  process.exit(1);
}

console.log(`Deployed successfully!`);
console.log(`  Actor types: ${data.actorTypes.join(", ")}`);
console.log(`  Deploy #${data.deployCount}`);
