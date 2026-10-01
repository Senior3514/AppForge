import path from "node:path";

/** @type {import('next').NextConfig} */
export default {
  // Self-contained server for the desktop installer (see scripts/build-agent.mjs). `next start` keeps working as before.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: ["@appforge/generator", "@appforge/i18n", "@appforge/modules", "@appforge/plans", "@appforge/spec", "@appforge/ui-tokens"],
  async redirects() {
    return [{ source: "/", destination: "/en", permanent: false }];
  },
};
