/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    turbo: {
      rules: {
        // Optional Turbo rules
      },
    },
  },
  // Ensure static asset handling is properly configured
  images: {
    domains: [],
  },
  // Properly handle CSS
  webpack(config) {
    return config;
  },
}

module.exports = nextConfig 