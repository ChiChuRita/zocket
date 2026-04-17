import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  appType: "spa",
  resolve: {
    alias: {
      "@zocket/client": resolve(__dirname, "../../../packages/client/src/index.ts"),
      "@zocket/react": resolve(__dirname, "../../../packages/react/src/index.ts"),
      "@zocket/core/protocol": resolve(__dirname, "../../../packages/core/src/protocol.ts"),
      "@zocket/core/types": resolve(__dirname, "../../../packages/core/src/types.ts"),
      "@zocket/core": resolve(__dirname, "../../../packages/core/src/index.ts"),
    },
  },
});
