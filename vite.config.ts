import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo, /api se reenvía a la API de agentguard-andimarket (python -m andimarket.api),
// así el navegador habla con un solo origen y no hace falta CORS. VITE_API_PROXY cambia el destino.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const destino = env.VITE_API_PROXY || "http://127.0.0.1:8000";
  return {
    plugins: [react()],
    server: { port: 5173, proxy: { "/api": { target: destino, changeOrigin: true } } },
    preview: { port: 4173, proxy: { "/api": { target: destino, changeOrigin: true } } },
  };
});
