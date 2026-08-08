/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.ELECTRON_BUILD ? "standalone" : undefined,
};

module.exports = nextConfig;
