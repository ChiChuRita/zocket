import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.tsx",
  dts: true,
  format: ["esm"],
  sourcemap: true,
  treeshake: true,
  external: ["react", "react-dom", "@zocket/core"],
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  hash: false,
  clean: true,
});
