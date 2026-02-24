import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
});
