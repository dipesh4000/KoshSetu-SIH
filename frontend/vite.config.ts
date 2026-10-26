import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API is proxied so the browser talks to one origin: the session cookie
// stays first-party and no CORS exception is needed in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
