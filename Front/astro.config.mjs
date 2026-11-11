import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  output: "static",
  integrations: [react()],
  markdown: { syntaxHighlight: false },
  build: { inlineStylesheets: "never" },
  security: {
    csp: {
      directives: [
        "default-src 'none'", "img-src data:", "connect-src 'none'",
        "font-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
      ],
      scriptDirective: { resources: ["'self'"] },
      styleDirective: { resources: ["'self'"] },
    },
  },
  devToolbar: { enabled: false },
});
