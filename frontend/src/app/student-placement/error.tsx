'use client';

import { useEffect } from 'react';
import { Box, Button, Heading, Text, VStack, Center, Alert, AlertIcon } from '@chakra-ui/react';

/**
 * 학생 배치 페이지 에러 컴포넌트
 * 학생 배치 관련 에러 발생 시 표시되는 페이지
 */
interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StudentPlacementError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 에러 로깅
    console.error('학생 배치 페이지 에러:', error);
  }, [error]);

  return (
    <Center h="100vh" w="100%">
      <VStack spacing={6} textAlign="center" maxW="lg" p={8}>
        <Heading size="lg" color="red.500">
          학생 배치 시스템 오류
        </Heading>
        
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">데이터 로딩 중 문제가 발생했습니다</Text>
            <Text fontSize="sm" mt={1}>
              학생 또는 교사 정보를 불러오는 중 오류가 발생했습니다.
            </Text>
          </Box>
        </Alert>
        
        {process.env.NODE_ENV === 'development' && (
          <Box 
            bg="red.50" 
            p={4} 
            borderRadius="md" 
            border="1px solid" 
            borderColor="red.200"
            maxW="100%"
            overflow="auto"
          >
            <Text fontSize="sm" color="red.600" fontFamily="mono">
              {error.message}
            </Text>
          </Box>
        )}
        
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
          
          <Text fontSize="sm" color="gray.500" mt={2}>
            문제가 지속되면 관리자에게 문의하세요.
          </Text>
        </VStack>
      </VStack>
    </Center>
  );
} 