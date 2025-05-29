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
      console.log('루트 페이지: 인증 상태 로딩 중...');
      return;
    }

    console.log('루트 페이지 권한 체크:', {
      isAuthenticated,
      user: user ? {
        id: user.id,
        username: user.username,
        is_active: user.is_active,
        is_staff: user.is_staff,
        is_superuser: user.is_superuser,
        is_teacher: user.is_teacher
      } : null
    });

    if (isAuthenticated && user) {
      // 계정이 비활성화된 경우
      if (!user.is_active) {
        console.log('계정 비활성화 - 404 페이지로 이동');
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

      // 로그인된 상태: 사용자 권한에 따라 리다이렉트
      if (user.is_superuser || user.is_staff) {
        // 슈퍼유저나 관리자는 학생 배치 페이지로
        console.log('관리자 권한 - 학생 배치 페이지로 이동');
        router.push('/student-placement');
      } else if (user.is_teacher) {
        // 강사는 마이페이지로 (관리자 여부와 상관없이)
        console.log('강사 권한 - 마이페이지로 이동:', `/mypage/${user.id}`);
        router.push(`/mypage/${user.id}`);
      } else {
        // 기본값: 학생 배치 페이지로 (예상치 못한 사용자 타입)
        console.log('기본 리다이렉션 - 학생 배치 페이지로 이동');
        router.push('/student-placement');
      }
    } else {
      // 로그인되지 않은 상태: 로그인 페이지로 리다이렉트
      console.log('비로그인 상태 - 로그인 페이지로 이동');
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