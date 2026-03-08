import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react()],

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

  server: {
    port: 5174,
    // Tauri expects a fixed port
    strictPort: true,
    // Allow Tauri's webview to connect
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  // Produce relative paths so Tauri can load from disk
  base: "./",

  resolve: {
    alias: {
      "@components": path.resolve(__dirname, "../client/src/components"),
      "@hooks": path.resolve(__dirname, "../client/src/hooks"),
      "@protocol": path.resolve(__dirname, "../client/src/protocol"),
      "@utils": path.resolve(__dirname, "../client/src/utils"),
      "@config": path.resolve(__dirname, "../client/src/config.js"),
    },
  },
});
