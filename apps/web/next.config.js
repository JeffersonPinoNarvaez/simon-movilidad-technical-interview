/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@fleet-portal/shared'],
};

module.exports = nextConfig;
