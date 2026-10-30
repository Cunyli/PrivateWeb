import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  devIndicators: false,
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    ]
    return [
      { source: '/:path*', headers: common },
      ...['/api/admin/:path*', '/api/ai-tasks', '/api/ai-feed', '/api/ai-feed/import', '/api/photo-session-booking'].map(source => ({ source, headers: [{ key: 'Cache-Control', value: 'private, no-store' }] })),
      // BotID's own challenge frames are permitted only within this origin.
      ...['/149e9513-01fa-4fb0-aad4-566afd725d1b/:path*', '/.well-known/vercel/security/:path*'].map(source => ({ source, headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] })),
    ]
  },
  async redirects() {
    return [{ source: '/work/100', destination: '/work/111?pictureId=2488&returnSet=111', permanent: true }]
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    loader: 'custom',
    loaderFile: './lib/portfolio-image-loader.js',
    qualities: [45, 55, 60, 75],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.cunyli.top',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'sjc.microlink.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Disable unstable experiments to avoid dev fallback chunk 500s
  experimental: {},
}

mergeConfig(nextConfig, userConfig)

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return
  }

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

export default nextConfig
