import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['skillmatch-4-dh8w.onrender.com'],
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_PROXY_TARGET || "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
  };
});
