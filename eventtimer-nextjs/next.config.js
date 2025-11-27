/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'polymarket.com',
      },
    ],
  },
  // 注意：不需要 rewrites，因为我们已经有了 /app/api/markets/route.ts
  // 这个 API 路由会自动处理代理请求，在 Vercel 上也能正常工作
}

module.exports = nextConfig
