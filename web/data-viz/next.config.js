/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/dash",
  assetPrefix: "/dash",
  distDir: "build",
  trailingSlash: true,
  output: "export",
};

module.exports = nextConfig;
