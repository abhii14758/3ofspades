import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow all origins for dev HMR (LAN play, any device on the network)
  allowedDevOrigins: ['*'],
  // Explicitly use webpack (not Turbopack) — required for custom server.ts + socket.io
  // bufferutil / utf-8-validate are optional ws perf packages; safe to skip
  webpack: (config) => {
    config.externals.push({
      bufferutil: 'bufferutil',
      'utf-8-validate': 'utf-8-validate',
    });
    return config;
  },
};

export default nextConfig;
