import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  appType: "spa",
  resolve: {
    alias: {
      // Point workspace packages to their source so Vite can bundle them
      "@zocket/client": resolve(__dirname, "../../../packages/client/src/index.ts"),
      "@zocket/core/protocol": resolve(__dirname, "../../../packages/core/src/protocol.ts"),
      "@zocket/core/types": resolve(__dirname, "../../../packages/core/src/types.ts"),
      "@zocket/core": resolve(__dirname, "../../../packages/core/src/index.ts"),
    },
  },
});
