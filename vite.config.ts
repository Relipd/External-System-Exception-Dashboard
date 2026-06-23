import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { semiTheming } from "vite-plugin-semi-theming";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    semiTheming({
      theme: "@semi-bot/semi-theme-feishu-dashboard",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5176,
  },
});
