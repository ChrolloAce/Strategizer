/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add experimental flag to help with server component modules
  experimental: {
    serverComponentsExternalPackages: [
      'fluent-ffmpeg',
      '@ffmpeg-installer/ffmpeg',
      'node-whisper',
      'ffmpeg-static',
      'openai'
    ]
  }
};

module.exports = nextConfig;
