import { ChakraProvider, Box } from '@chakra-ui/react';
import type { Metadata } from 'next';
import Navigation from '@/components/Navigation';
import { AuthProvider } from '@/lib/authContext';

export const metadata: Metadata = {
  title: '프로젝트 관리 시스템',
  description: 'Django, Next.js, PostgreSQL 기반 프로젝트 관리 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <ChakraProvider>
          <AuthProvider>
            <Navigation />
            <Box as="main">
              {children}
            </Box>
          </AuthProvider>
        </ChakraProvider>
      </body>
    </html>
  );
} 