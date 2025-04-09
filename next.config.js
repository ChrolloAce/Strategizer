/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure server-only packages
  transpilePackages: [
    'fluent-ffmpeg',
    '@ffmpeg-installer/ffmpeg',
    'node-whisper',
    'ffmpeg-static',
    'openai'
  ],
  
  // Completely disable ESLint checks during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript type checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable strict mode for development
  reactStrictMode: false
};

module.exports = nextConfig;
