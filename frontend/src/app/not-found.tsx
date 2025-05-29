'use client';

import { Box, Button, Heading, Text, VStack, Center } from '@chakra-ui/react';
import Link from 'next/link';

/**
 * 404 페이지 컴포넌트
 * Next.js App Router에서 페이지를 찾을 수 없을 때 표시되는 컴포넌트
 */
export default function NotFound() {
  return (
    <Center h="100vh" w="100%">
      <VStack spacing={6} textAlign="center" maxW="md" p={8}>
        <Heading size="2xl" color="gray.600">
          404
        </Heading>
        
        <Heading size="lg" color="gray.700">
          페이지를 찾을 수 없습니다
        </Heading>
        
        <Text color="gray.600" fontSize="md">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </Text>
        
        <VStack spacing={3}>
          <Link href="/" passHref>
            <Button 
              colorScheme="blue" 
              size="lg"
              as="a"
            >
              홈으로 돌아가기
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            size="md"
          >
            이전 페이지로
          </Button>
        </VStack>
      </VStack>
    </Center>
  );
} 