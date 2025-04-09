/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure server-only packages
  transpilePackages: [
    'fluent-ffmpeg',
    '@ffmpeg-installer/ffmpeg',
    'node-whisper',
    'ffmpeg-static',
    'openai'
  ]
};

module.exports = nextConfig;
