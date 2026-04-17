import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
      {
        find: /^@zocket\/core$/,
        replacement: path.resolve(__dirname, "../core/src/index.ts"),
      },
      {
        find: /^@zocket\/core\/(.*)$/,
        replacement: path.resolve(__dirname, "../core/src/$1"),
      },
    ],
  },
  server: {
    port: 5173,
  },
});
