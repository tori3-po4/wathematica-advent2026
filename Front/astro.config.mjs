import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  // Keep content and all assets in one downloadable, offline-capable HTML file.
  compressHTML: false,
  build: { inlineStylesheets: "always" },
  devToolbar: { enabled: false },
});
