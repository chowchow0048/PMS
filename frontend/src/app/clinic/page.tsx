'use client';

import React from 'react';
import {
  Box,
  Container,
  Heading,
  VStack,
  Text,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Center,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/lib/authGuard';

/**
 * 오늘의 클리닉 페이지 (비활성화됨)
 * 보충 시스템 개편으로 인해 기존 기능이 더 이상 사용되지 않음
 */
const ClinicPageContent: React.FC = () => {
  const router = useRouter();

  const handleGoHome = () => {
    router.push('/');
  };

  const handleGoToReservation = () => {
    router.push('/clinic/reserve');
  };

  return (
    <Container maxW="4xl" py={8} pt="100px">
      <Center minH="60vh">
        <VStack spacing={8} textAlign="center" maxW="2xl">
          <Box>
            <Heading size="2xl" color="gray.600" mb={4}>
              📅 오늘의 클리닉
            </Heading>
            <Text fontSize="lg" color="gray.500">
              기능 비활성화
            </Text>
          </Box>

          <Alert
            status="warning"
            variant="subtle"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            minH="200px"
            borderRadius="lg"
          >
            <AlertIcon boxSize="40px" mr={0} />
            <AlertTitle mt={4} mb={1} fontSize="lg">
              보충 시스템 개편
            </AlertTitle>
            <AlertDescription maxWidth="sm" fontSize="md">
              기존의 "오늘의 클리닉" 기능은 보충 시스템 개편으로 인해 
              더 이상 사용되지 않습니다.
              <br />
              <br />
              새로운 클리닉 예약 시스템을 이용해주세요.
            </AlertDescription>
          </Alert>

          <VStack spacing={4}>
            <Button 
              colorScheme="blue" 
              size="lg"
              onClick={handleGoToReservation}
            >
              새 클리닉 예약 시스템 이용하기
            </Button>
            <Button 
              variant="outline" 
              size="md"
              onClick={handleGoHome}
            >
              홈으로 돌아가기
            </Button>
          </VStack>

          <Box pt={8} borderTop="1px solid" borderColor="gray.200" w="full">
            <Text fontSize="sm" color="gray.500">
              문의사항이 있으시면 관리자에게 연락해주세요.
            </Text>
          </Box>
        </VStack>
      </Center>
    </Container>
  );
};

// AuthGuard로 감싸서 인증된 사용자만 접근 가능
const ClinicPage: React.FC = () => {
  return (
    <AuthGuard allowedRoles={['teacher', 'admin', 'student']} requireAuth={true}>
      <ClinicPageContent />
    </AuthGuard>
  );
};

export default ClinicPage;

 