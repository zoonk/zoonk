import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.local"],
  devIndicators: false,
  experimental: { typedEnv: true },
  images: {
    remotePatterns: [
      new URL("https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/**"),
      new URL("https://mvrkldmanjesbxos.public.blob.vercel-storage.com/**"),
    ],
  },
  pageExtensions: ["ts", "tsx"],
  reactCompiler: true,
  turbopack: {
    rules: {
      // Allow to import MDX files used for AI prompts
      "*.md": { as: "*.js", loaders: ["raw-loader"] },
    },
  },
  typedRoutes: true,
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
