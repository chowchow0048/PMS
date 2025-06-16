'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast, Center, Spinner, Text, Box } from '@chakra-ui/react';
import { useAuth } from './authContext';

// 권한 타입 정의
export type UserRole = 'admin' | 'teacher' | 'student';

// AuthGuard 프롭스 인터페이스
interface AuthGuardProps {
  children: ReactNode;
  allowedRoles?: UserRole[]; // 허용된 역할 목록
  requireAuth?: boolean; // 인증 필요 여부 (기본값: true)
  redirectTo?: string; // 권한이 없을 때 리다이렉트할 경로
}

/**
 * 권한 기반 라우팅을 위한 AuthGuard 컴포넌트
 * 사용자의 권한을 체크하고 적절한 페이지로 리다이렉트합니다.
 */
export function AuthGuard({ 
  children, 
  allowedRoles = [], 
  requireAuth = true,
  redirectTo 
}: AuthGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  // 사용자 역할 확인 함수
  const getUserRole = (): UserRole | null => {
    if (!user) return null;
    
    // 관리자 또는 슈퍼유저인 경우
    if (user.is_superuser || user.is_staff) {
      return 'admin';
    }
    
    // 일반 강사인 경우
    if (user.is_teacher && !user.is_staff && !user.is_superuser) {
      return 'teacher';
    }
    
    // 기본값: 학생
    return 'student';
  };

  // 권한 체크 및 리다이렉트 처리
  useEffect(() => {
    // 로딩 중이면 대기
    if (isLoading) {
      console.log('AuthGuard: 로딩 중...');
      return;
    }

    console.log('AuthGuard 권한 체크:', {
      allowedRoles,
      requireAuth,
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

    // 인증이 필요한데 로그인되지 않은 경우
    if (requireAuth && !isAuthenticated) {
      console.log('AuthGuard: 인증 필요 - 로그인 페이지로 이동');
      toast({
        title: '접근 권한 없음',
        description: '로그인이 필요한 페이지입니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      router.push('/login');
      return;
    }

    // 계정이 비활성화된 경우
    if (user && !user.is_active) {
      console.log('AuthGuard: 계정 비활성화 - 404 페이지로 이동');
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

    // 특정 역할이 필요한 경우 권한 체크
    if (allowedRoles.length > 0 && user) {
      const userRole = getUserRole();
      console.log('AuthGuard: 사용자 역할 체크:', { userRole, allowedRoles });
      
      if (!userRole || !allowedRoles.includes(userRole)) {
        // 권한이 없는 경우
        const defaultRedirect = userRole === 'teacher' ? `/mypage/${user.id}` : '/student-placement';
        const targetRedirect = redirectTo || defaultRedirect;
        
        console.log('AuthGuard: 권한 없음 - 리다이렉트:', targetRedirect);
        toast({
          title: '접근 권한 없음',
          description: '이 페이지에 접근할 권한이 없습니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        
        router.push(targetRedirect);
        return;
      }
    }

    console.log('AuthGuard: 권한 체크 통과');
  }, [isLoading, isAuthenticated, user, allowedRoles, requireAuth, redirectTo, router, toast]);

  // 로딩 중일 때 스피너 표시
  if (isLoading) {
    return (
      <Center h="100vh">
        <Box textAlign="center">
          <Spinner size="xl" color="blue.500" mb={4} />
          <Text>권한을 확인하는 중...</Text>
        </Box>
      </Center>
    );
  }

  // 인증이 필요한데 로그인되지 않은 경우 빈 화면 반환
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  // 계정이 비활성화된 경우 빈 화면 반환
  if (user && !user.is_active) {
    return null;
  }

  // 권한이 있는 경우 자식 컴포넌트 렌더링
  if (allowedRoles.length > 0 && user) {
    const userRole = getUserRole();
    if (!userRole || !allowedRoles.includes(userRole)) {
      // 리다이렉트 처리 중이므로 로딩 스피너 표시
      return (
        <Center h="100vh">
          <Box textAlign="center">
            <Spinner size="xl" color="blue.500" mb={4} />
            <Text>페이지를 이동하는 중...</Text>
          </Box>
        </Center>
      );
    }
  }

  return <>{children}</>;
}

/**
 * 관리자 전용 페이지를 위한 HOC
 */
export function withAdminAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AdminProtectedComponent(props: P) {
    return (
      <AuthGuard allowedRoles={['admin']}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}

/**
 * 강사 전용 페이지를 위한 HOC
 */
export function withTeacherAuth<P extends object>(Component: React.ComponentType<P>) {
  return function TeacherProtectedComponent(props: P) {
    return (
      <AuthGuard allowedRoles={['teacher']}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}

/**
 * 관리자 또는 강사 페이지를 위한 HOC
 */
export function withAdminOrTeacherAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AdminOrTeacherProtectedComponent(props: P) {
    return (
      <AuthGuard allowedRoles={['admin', 'teacher']}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}

/**
 * 마이페이지 전용 권한 체크 컴포넌트
 * 사용자는 자신의 마이페이지만 접근 가능하고, 관리자는 모든 마이페이지에 접근 가능
 */
interface MyPageGuardProps {
  children: ReactNode;
  pageUserId: string; // URL에서 가져온 사용자 ID
}

export function MyPageGuard({ children, pageUserId }: MyPageGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    // 로딩 중이면 대기
    if (isLoading) {
      console.log('MyPageGuard: 로딩 중...');
      return;
    }

    console.log('MyPageGuard 권한 체크 시작:', {
      pageUserId,
      pageUserIdType: typeof pageUserId,
      isAuthenticated,
      user: user ? {
        id: user.id,
        idType: typeof user.id,
        username: user.username,
        is_active: user.is_active,
        is_staff: user.is_staff,
        is_superuser: user.is_superuser,
        is_teacher: user.is_teacher
      } : null
    });

    // 인증되지 않은 경우
    if (!isAuthenticated || !user) {
      console.log('MyPageGuard: 인증되지 않음 - 로그인 페이지로 이동');
      toast({
        title: '로그인 필요',
        description: '로그인이 필요한 페이지입니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      router.push('/login');
      return;
    }

    // 계정이 비활성화된 경우
    if (!user.is_active) {
      console.log('MyPageGuard: 계정 비활성화 - 404 페이지로 이동');
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

    // URL 파라미터 정리
    const cleanPageUserId = decodeURIComponent(pageUserId).trim();
    
    console.log('MyPageGuard: URL 파라미터 정리:', {
      originalPageUserId: pageUserId,
      cleanPageUserId,
      cleanPageUserIdType: typeof cleanPageUserId
    });

    // 잘못된 URL 파라미터 체크 (예: [id] 등)
    if (cleanPageUserId.includes('[') || cleanPageUserId.includes(']') || cleanPageUserId === 'id') {
      console.log('MyPageGuard: 잘못된 URL 파라미터 - 올바른 마이페이지로 리다이렉트');
      router.replace(`/mypage/${user.id}`);
      return;
    }

    // 숫자가 아닌 ID인 경우
    if (!/^\d+$/.test(cleanPageUserId)) {
      console.log('MyPageGuard: 유효하지 않은 사용자 ID - 올바른 마이페이지로 리다이렉트');
      router.replace(`/mypage/${user.id}`);
      return;
    }

    // 권한 체크 - 타입 통일
    const requestedUserId = parseInt(cleanPageUserId, 10);
    const currentUserId = parseInt(user.id.toString(), 10); // 문자열일 수도 있으므로 변환
    const isAdmin = user.is_superuser || user.is_staff;
    const isOwnPage = currentUserId === requestedUserId;

    console.log('MyPageGuard: 권한 체크 상세:', {
      requestedUserId,
      requestedUserIdType: typeof requestedUserId,
      currentUserId,
      currentUserIdType: typeof currentUserId,
      originalUserId: user.id,
      originalUserIdType: typeof user.id,
      isAdmin,
      isOwnPage,
      isTeacher: user.is_teacher,
      comparison: `${currentUserId} === ${requestedUserId} = ${currentUserId === requestedUserId}`
    });

    // 관리자는 모든 페이지 접근 가능
    if (isAdmin) {
      console.log('MyPageGuard: 관리자 권한으로 접근 허용');
      return;
    }

    // 강사는 자신의 페이지만 접근 가능
    if (user.is_teacher && isOwnPage) {
      console.log('MyPageGuard: 강사가 자신의 마이페이지 접근 허용');
      return;
    }

    // 일반 사용자는 자신의 페이지만 접근 가능
    if (isOwnPage) {
      console.log('MyPageGuard: 사용자가 자신의 마이페이지 접근 허용');
      return;
    }

    // 권한이 없는 경우
    console.log('MyPageGuard: 권한 없음 - 자신의 마이페이지로 리다이렉트');
    toast({
      title: '접근 권한 없음',
      description: '자신의 마이페이지만 접근할 수 있습니다.',
      status: 'error',
      duration: 3000,
      isClosable: true,
    });
    router.replace(`/mypage/${user.id}`);
    return;

  }, [isLoading, isAuthenticated, user, pageUserId, router, toast]);

  // 로딩 중일 때 스피너 표시
  if (isLoading) {
    return (
      <Center h="100vh">
        <Box textAlign="center">
          <Spinner size="xl" color="blue.500" mb={4} />
          <Text>권한을 확인하는 중...</Text>
        </Box>
      </Center>
    );
  }

  // 인증되지 않은 경우 빈 화면 반환
  if (!isAuthenticated || !user) {
    return null;
  }

  // 계정이 비활성화된 경우 빈 화면 반환
  if (!user.is_active) {
    return null;
  }

  // 권한 체크
  const cleanPageUserId = decodeURIComponent(pageUserId).trim();
  
  // 잘못된 URL 파라미터인 경우 로딩 스피너 표시
  if (cleanPageUserId.includes('[') || cleanPageUserId.includes(']') || !/^\d+$/.test(cleanPageUserId)) {
    return (
      <Center h="100vh">
        <Box textAlign="center">
          <Spinner size="xl" color="blue.500" mb={4} />
          <Text>페이지를 이동하는 중...</Text>
        </Box>
      </Center>
    );
  }

  const requestedUserId = parseInt(cleanPageUserId, 10);
  const currentUserId = parseInt(user.id.toString(), 10); // 타입 통일
  const isAdmin = user.is_superuser || user.is_staff;
  const isOwnPage = currentUserId === requestedUserId;

  // 권한이 없는 경우 빈 화면 반환
  if (!isAdmin && !isOwnPage) {
    return null;
  }

  return <>{children}</>;
}