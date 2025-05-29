'use client';

import { useEffect } from 'react';
import { Box, Button, Heading, Text, VStack, Center } from '@chakra-ui/react';

/**
 * 에러 페이지 컴포넌트
 * Next.js App Router에서 에러 발생 시 표시되는 페이지
 */
interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 에러 로깅
    console.error('페이지 에러:', error);
  }, [error]);

  return (
    <Center h="100vh" w="100%">
      <VStack spacing={6} textAlign="center" maxW="md" p={8}>
        <Heading size="lg" color="red.500">
          오류가 발생했습니다
        </Heading>
        
        <Text color="gray.600" fontSize="md">
          페이지를 불러오는 중 문제가 발생했습니다.
          {process.env.NODE_ENV === 'development' && (
            <>
              <br />
              <Text as="span" fontSize="sm" color="red.400" mt={2} display="block">
                {error.message}
              </Text>
            </>
          )}
        </Text>
        
        <VStack spacing={3}>
          <Button 
            colorScheme="blue" 
            onClick={reset}
            size="lg"
          >
            다시 시도
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/'}
            size="md"
          >
            홈으로 돌아가기
          </Button>
        </VStack>
      </VStack>
    </Center>
  );
} 