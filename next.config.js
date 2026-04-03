/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep native-binary packages out of the webpack bundle so they
  // resolve correctly in both local Node.js and Vercel serverless.
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
}

module.exports = nextConfig
