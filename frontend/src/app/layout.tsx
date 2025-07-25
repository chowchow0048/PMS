import { ChakraProvider, Box } from '@chakra-ui/react';
import type { Metadata } from 'next';
import Navigation from '@/components/Navigation';
import { AuthProvider } from '@/lib/authContext';

export const metadata: Metadata = {
  title: '물리단',
  description: '우리는 물리단!',
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