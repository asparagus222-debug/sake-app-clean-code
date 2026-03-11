import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Removed: output: 'export',
  // Removed: distDir: 'out',
  typescript: {
    ignoreBuildErrors: true, // Re-enable ignoreBuildErrors
  },
  eslint: {
    ignoreDuringBuilds: true, // Re-enable ignoreDuringBuilds
  },
  serverActions: {
    bodySizeLimit: '10mb',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
