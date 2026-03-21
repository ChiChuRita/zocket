import { defineConfig } from "tsdown";

const external = [
  "bun",
  "@standard-schema/spec",
];

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    "server/server": "./src/server/server.ts",
    "server/adapters/bun": "./src/server/adapters/bun.ts",
  },
  dts: true,
  format: ["esm"],
  sourcemap: true,
  treeshake: true,
  external,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  hash: false,
  clean: true,
});
