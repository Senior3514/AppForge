/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@appforge/generator", "@appforge/i18n", "@appforge/modules", "@appforge/plans", "@appforge/spec", "@appforge/ui-tokens"],
  async redirects() {
    return [{ source: "/", destination: "/en", permanent: false }];
  },
};
