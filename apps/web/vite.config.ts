import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@whatsfiled/ui": resolve(__dirname, "../../packages/ui/src"),
    },
  },
  server: {
    port: 3001,
  },
});
