/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add experimental flag to help with server component modules
  experimental: {
    serverExternalPackages: [
      'fluent-ffmpeg',
      '@ffmpeg-installer/ffmpeg',
      'node-whisper',
      'ffmpeg-static',
      'openai'
    ]
  }
};

module.exports = nextConfig;
