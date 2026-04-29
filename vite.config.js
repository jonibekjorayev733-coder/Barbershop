import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
export default defineConfig({
    plugins: [react()],
    build: {
        // Code splitting untuk smaller chunks
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ["react", "react-dom"],
                },
            },
        },
        // Optimize chunk sizes
        chunkSizeWarningLimit: 500,
        // Enable compression
        minify: "terser",
        terserOptions: {
            compress: {
                drop_console: true,
            },
        },
    },
    // Optimize dependencies
    optimizeDeps: {
        include: ["react", "react-dom"],
    },
});
