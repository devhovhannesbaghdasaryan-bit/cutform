import createNextIntlPlugin from 'next-intl/plugin';

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
  // The legacy token-priced /products/[id] route is gone (Phase 17); send any
  // inbound links to the live catalog. Single-segment :id only, so static
  // assets under /products/night-lights/... are unaffected.
  async redirects() {
    return [
      {
        source: '/products/:id',
        destination: '/catalog',
        permanent: true,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '22mb',
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
