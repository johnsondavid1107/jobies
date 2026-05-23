/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  webpack: (config) => {
    config.externals = config.externals || [];
    return config;
  },
};
export default nextConfig;
