/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    // pdfkit reads .afm font-metric files from its own package dir at runtime.
    // Bundling it drops those data files (ENOENT on Helvetica.afm); keep it
    // external so it's required from node_modules where the .afm files exist.
    serverComponentsExternalPackages: ['pdfkit'],
  },
  webpack: (config) => {
    config.externals = config.externals || [];
    return config;
  },
};
export default nextConfig;
