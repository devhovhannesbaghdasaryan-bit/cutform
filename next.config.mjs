/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Local Supabase Storage resolves to a loopback IP. Keep this exception
    // development-only so production image optimization retains SSRF protection.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/sign/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '54321',
        pathname: '/storage/v1/object/sign/**',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
  // jsdom (pulled in by isomorphic-dompurify) ships its own asset files;
  // bundling breaks it. Load these as Node externals at runtime.
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom'],
  experimental: {
    serverActions: {
      bodySizeLimit: '22mb',
    },
  },
};

export default nextConfig;
