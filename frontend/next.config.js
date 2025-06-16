const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 개발 환경에서 빠른 새로고침 활성화
  experimental: {
    optimizePackageImports: ['@chakra-ui/react'],
  },
  // 컴파일 최적화 (Turbopack 호환)
  ...(process.env.NODE_ENV === 'production' && !process.env.TURBOPACK && {
    compiler: {
      removeConsole: true,
    },
  }),
  // 개발 환경 최적화 (Webpack 전용)
  ...(!process.env.TURBOPACK && {
    webpack: (config, { dev, isServer }) => {
      if (dev && !isServer) {
        // 개발 환경에서 빠른 새로고침을 위한 설정
        config.watchOptions = {
          poll: 1000,
          aggregateTimeout: 300,
        };
      }
      return config;
    },
  }),
  // 프록시 설정 제거 - 직접 백엔드 URL 사용
  // async rewrites() {
  //   return [
  //     {
  //       source: '/api/:path*',
  //       destination: 'http://localhost:8000/api/:path*', // Django 백엔드 URL
  //     },
  //   ];
  // },
  // 에러 처리 개선
  onDemandEntries: {
    // 페이지가 메모리에 유지되는 시간 (밀리초)
    maxInactiveAge: 25 * 1000,
    // 동시에 메모리에 유지할 페이지 수
    pagesBufferLength: 2,
  },
};

module.exports = withBundleAnalyzer(nextConfig); 