/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // jsdom (pulled in by isomorphic-dompurify) ships its own asset files;
  // bundling breaks it. Load these as Node externals at runtime.
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom'],
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
