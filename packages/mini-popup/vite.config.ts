import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: { entry: "src/index.tsx", formats: ["es"], fileName: "index" },
    rollupOptions: { external: ["react", "react-dom/client", "react/jsx-runtime"] },
  },
});
