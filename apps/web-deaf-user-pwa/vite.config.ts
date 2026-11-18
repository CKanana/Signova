import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,tflite,task,json,wasm,woff2,webmanifest}",
        ],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024, // allow large .wasm and .tflite assets
        cleanupOutdatedCaches: true,
      },
      manifest: {
        id: "/",
        name: "Signova",
        short_name: "Signova",
        description: "ASL to text translation for Deaf and hard-of-hearing service users.",
        theme_color: "#5B2A86",
        background_color: "#FFF8DC",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "en",
        icons: [
          {
            src: "/icons/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png",
          },
          {
            src: "/icons/favicon-32x32.png",
            sizes: "32x32",
            type: "image/png",
          },
          {
            src: "/icons/favicon-16x16.png",
            sizes: "16x16",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    // VS Code / Dev Tunnels serves the forwarded site under *.devtunnels.ms.
    // Vite rejects unknown Host headers by default (DNS-rebinding guard).
    allowedHosts: [".devtunnels.ms"],
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    host: true,
    allowedHosts: [".devtunnels.ms"],
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
})
