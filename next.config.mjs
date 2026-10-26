const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["bullmq", "ioredis", "nodemailer", "@google-cloud/storage"],
  experimental: {
    // resume + up to 3 documents at 5MB each, plus multipart overhead
    serverActions: {
      bodySizeLimit: "22mb",
      // Behind a proxy/tunnel the Origin must match the public host.
      allowedOrigins: process.env.APP_URL ? [new URL(process.env.APP_URL).host] : undefined,
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
