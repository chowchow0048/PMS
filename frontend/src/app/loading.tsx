import { Box, Spinner, Text, Center, VStack } from '@chakra-ui/react';

/**
 * 로딩 페이지 컴포넌트
 * Next.js App Router에서 페이지 로딩 중 표시되는 컴포넌트
 */
export default function Loading() {
  return (
    <Center h="100vh" w="100%">
      <VStack spacing={4}>
        <Spinner 
          size="xl" 
          color="blue.500" 
          thickness="4px"
          speed="0.65s"
        />
        <Text color="gray.600" fontSize="lg">
          페이지를 불러오는 중...
        </Text>
      </VStack>
    </Center>
  );
} 