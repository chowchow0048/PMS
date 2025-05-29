import { Box, Spinner, Text, Center, VStack, Progress } from '@chakra-ui/react';

/**
 * 학생 배치 페이지 로딩 컴포넌트
 * 학생 배치 데이터 로딩 중 표시되는 컴포넌트
 */
export default function StudentPlacementLoading() {
  return (
    <Center h="100vh" w="100%">
      <VStack spacing={6} maxW="md" textAlign="center">
        <Spinner 
          size="xl" 
          color="blue.500" 
          thickness="4px"
          speed="0.65s"
        />
        
        <VStack spacing={2}>
          <Text color="gray.700" fontSize="lg" fontWeight="medium">
            학생 배치 시스템 로딩 중...
          </Text>
          <Text color="gray.500" fontSize="sm">
            학생 및 교사 정보를 불러오고 있습니다
          </Text>
        </VStack>
        
        <Box w="100%" maxW="300px">
          <Progress 
            size="sm" 
            isIndeterminate 
            colorScheme="blue" 
            borderRadius="md"
          />
        </Box>
      </VStack>
    </Center>
  );
} 