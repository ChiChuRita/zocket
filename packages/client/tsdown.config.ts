import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  platform: "browser",
  dts: true,
  format: ["esm"],
  sourcemap: true,
  treeshake: true,
  external: ["@zocket/core"],
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  hash: false,
  clean: true,
});
