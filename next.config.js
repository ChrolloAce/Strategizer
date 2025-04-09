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
  
  // Disable specific ESLint rules
  eslint: {
    // Warning: only use this in development!
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;
