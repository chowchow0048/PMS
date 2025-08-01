// 안전한 bundle analyzer 로드
let withBundleAnalyzer;
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
} catch (error) {
  // 프로덕션 환경에서 @next/bundle-analyzer가 없을 경우 기본 함수 사용
  withBundleAnalyzer = (config) => config;
}

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
  // webpack 설정 (Path alias 포함)
  webpack: (config, { dev, isServer }) => {
    const path = require('path');
    
    // Path alias 설정 (Vercel 빌드 호환성 향상)
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src'),
    };
    
    // 개발 환경에서만 추가 최적화 설정
    if (dev && !isServer && !process.env.TURBOPACK) {
      // 개발 환경에서 빠른 새로고침을 위한 설정
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
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