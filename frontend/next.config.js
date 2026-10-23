/** @type {import('next').NextConfig} */
const { version } = require("./package.json");

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  // Next.js build metadata is not served at /_next/. Precaching it would
  // return 404 and prevent the new service worker from installing.
  buildExcludes: [/^dynamic-css-manifest\.json$/],
  // the api stays out of the service worker entirely, uploads, downloads and
  // range requests go straight to the network
  runtimeCaching: [
    {
      urlPattern: /^(?!.*\/api(\/|$)).*/,
      handler: "NetworkOnly",
    },
  ],
});

module.exports = withPWA({
  transpilePackages: ["@uiw/react-md-editor", "@uiw/react-markdown-preview"],
  output: "standalone",
  // no need to tell every visitor which framework answers
  poweredByHeader: false,
  // Rotate asset URLs after Cloudflare challenged the share page's JS chunk.
  // Keep the salt fixed so content hashes still provide stable cache keys.
  // This avoids the current false positive, not future WAF misclassifications.
  // See docs/waf-assets.md for deployment verification.
  outputHashSalt: "pingvin-share-x-assets-v1",
  images: {
    unoptimized: true,
  },
  env: {
    VERSION: version,
    // The version alone cannot tell two builds of the same beta apart, which
    // matters when working out what is actually running on a server. Supplied
    // as a build argument because .git is not in the docker build context.
    // Empty for a build that was not told, and the admin page then omits it.
    // Cut to the seven characters that get displayed, because next inlines
    // this value literally and there is no reason to ship the other thirty
    // three to every browser.
    BUILD_COMMIT: (process.env.BUILD_COMMIT ?? "").trim().slice(0, 7),
  },
});
