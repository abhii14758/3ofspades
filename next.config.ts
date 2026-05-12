import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow all origins for dev HMR (LAN play, any device on the network)
  allowedDevOrigins: ['*'],
  // Required to silence Turbopack warning when webpack config is present
  turbopack: {},
  // Required for socket.io with custom server
  webpack: (config) => {
    config.externals.push({
      bufferutil: 'bufferutil',
      'utf-8-validate': 'utf-8-validate',
    });
    return config;
  },
};

export default nextConfig;
