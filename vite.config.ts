// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import open from "open";
import os from "os"; // Imported to safely query the local machine's hostname

export default defineConfig(({ mode }) => {
  // Load environment variables (.env files) explicitly for Vite configuration
  const env = loadEnv(mode, process.cwd(), "");

  // Dynamically resolve the host machine's name
  const hostname = os.hostname() || process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown-dev-machine";

  return {
    // Inject the resolved hostname into the global client scope
    define: {
      __DEV_MACHINE_NAME__: JSON.stringify(hostname)
    },

    plugins: [
      react(),
      {
        name: "open-browser-on-start",
        configureServer(server) {
          server.httpServer?.once("listening", () => {
            const port = server.config.server.port ?? 5173;
            const url = `http://localhost:${port}`;
            open(url);
          });
        }
      }
    ],

    server: {
      port: 5173,

      proxy: {
        // Proxy requests from http://localhost:5173/express/* to your Express backend
        "/express": {
          // Uses env variable, with a fallback to port 3000 to prevent crashes
          target: env.VITE_EXPRESS_SERVER || "http://localhost:3000",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/express/, "")
        },

        // Proxy requests from http://localhost:5173/apm/* directly to the APM server
        "/apm": {
          // Uses env variable, with a default fallback to a standard APM local port
          target: env.VITE_APM_SERVER || "http://localhost:8200",
          changeOrigin: true,
          secure: false,

          // /apm/intake/v2/events → /intake/v2/events
          rewrite: (path) => path.replace(/^\/apm/, ""),

          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              // Inject APM token securely from environment variables
              proxyReq.setHeader(
                "Authorization",
                `ApiKey ${env.VITE_APM_TOKEN || ""}`
              );

              // Enable NDJSON support required by Elastic APM intake API
              proxyReq.setHeader("Content-Type", "application/x-ndjson");
            });
          }
        }
      }
    }
  };
});
