/** @type {import('next').NextConfig} */
const nextConfig = {
  // compile the workspace TS packages from source (used from Stage 2 onward)
  transpilePackages: ["@carbridge/shared", "@carbridge/fx"],
};
export default nextConfig;
