import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

// relative base: the site works under any path (GitHub Pages included)
export default defineConfig({
  base: "./",
  plugins: [tailwindcss(), svelte()],
  worker: { format: "es" },
  server: { fs: { allow: ["../.."] } },
});
