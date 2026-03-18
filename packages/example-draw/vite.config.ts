import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@zocket/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@zocket/client": path.resolve(__dirname, "../client/src/index.ts"),
      "@zocket/react": path.resolve(__dirname, "../react/src/index.ts"),
    },
  },
});
