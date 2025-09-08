'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Spinner, Text, Center, useToast } from '@chakra-ui/react';
import { useAuth } from '@/lib/authContext';

/**
 * 루트 페이지 컴포넌트
 * 로그인 여부와 사용자 권한에 따라 적절한 페이지로 리다이렉트합니다.
 * - 관리자/슈퍼유저: /student-placement로 리다이렉트
 * - 일반 강사: /mypage/[id]로 리다이렉트
 * - 로그인되지 않은 상태: /login으로 리다이렉트
 */

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();
  const { isAuthenticated, user, isLoading } = useAuth();

  useEffect(() => {
    // 인증 상태 로딩 중이면 대기
    if (isLoading) {
      return;
    }

    if (isAuthenticated && user) {
      // 계정이 비활성화된 경우
      if (!user.is_active) {
        toast({
          title: '계정 비활성화',
          description: '계정이 비활성화되었습니다. 관리자에게 문의하세요.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        router.push('/404');
        return;
      }

      // 로그인된 상태: 사용자 권한에 따라 리다이렉트 (백엔드와 동일한 우선순위)
      if (user.is_superuser) {
        // 슈퍼유저는 기본 관리 페이지로
        router.push('/student-placement');
      } else if (user.is_student) {
        // 학생은 클리닉 예약 페이지로 (우선순위 높음)
        router.push('/clinic/reserve');
      } else if (user.is_staff && !user.is_superuser && !user.is_student) {
        // 관리자는 학생 배치 페이지로 (학생이 아닌 경우만)
        router.push('/student-placement');
      } else if (user.is_teacher) {
        // 강사는 마이페이지로
        router.push(`/mypage/${user.id}`);
      } else {
        // 기본값: 클리닉 예약 페이지로
        router.push('/clinic/reserve');
      }
    } else {
      // 로그인되지 않은 상태: 로그인 페이지로 리다이렉트
      router.push('/login');
    }
  }, [isAuthenticated, user, isLoading, router, toast]);

  // 리다이렉트 처리 중 로딩 화면 표시
  return (
    <Center h="100vh">
      <Box textAlign="center">
        <Spinner size="xl" color="blue.500" mb={4} />
        <Text>페이지를 불러오는 중...</Text>
      </Box>
    </Center>
  );
} 