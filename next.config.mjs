/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-host friendly: standalone output for Docker
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
