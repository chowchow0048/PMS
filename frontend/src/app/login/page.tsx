'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  Container, 
  Flex, 
  Input, 
  Button, 
  VStack, 
  FormControl, 
  FormLabel, 
  InputGroup, 
  InputRightElement,
  Heading,
  useToast,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { login } from '@/lib/api';
import { useAuth } from '@/lib/authContext';

/**
 * 로그인 페이지 컴포넌트
 * 사용자 인증을 처리하고 권한에 따라 적절한 페이지로 리다이렉트합니다.
 */
export default function LoginPage() {
  // 폼 입력 상태 관리
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 비밀번호 변경 모달 상태
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState<any>(null);

  // Next.js 라우터와 인증 상태 관리
  const router = useRouter();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { login: authLogin, isAuthenticated } = useAuth();

  // 이미 로그인된 사용자 리다이렉트 처리
  useEffect(() => {
    if (isAuthenticated) {
      // 이미 로그인된 경우 메인 페이지로 이동 (권한별 라우팅은 메인 페이지에서 처리)
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // 비밀번호 표시/숨김 토글 핸들러
  const handleShowPassword = () => setShowPassword(!showPassword);

  // 비밀번호 변경 처리
  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: '입력 오류',
        description: '새 비밀번호를 모두 입력해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: '비밀번호 불일치',
        description: '새 비밀번호가 일치하지 않습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (newPassword.length < 4) {
      toast({
        title: '비밀번호 길이 오류',
        description: '비밀번호는 최소 4자리 이상이어야 합니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setChangingPassword(true);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/auth/change_password/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${pendingLoginData.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: pendingLoginData.user.username, // 현재 비밀번호는 아이디와 동일
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: '비밀번호 변경 완료',
          description: '비밀번호가 성공적으로 변경되었습니다.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        // 모달 닫기 및 상태 초기화
        onClose();
        setNewPassword('');
        setConfirmPassword('');

        // 로그인 완료 처리
        authLogin(pendingLoginData.token, pendingLoginData.user, false);

        // 리다이렉트 처리
        if (pendingLoginData.redirect) {
          router.push(pendingLoginData.redirect);
        } else if (pendingLoginData.user.is_student) {
          router.push('/clinic/reserve');
        } else {
          router.push('/');
        }
      } else {
        toast({
          title: '비밀번호 변경 실패',
          description: data.error || '비밀번호 변경 중 오류가 발생했습니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('비밀번호 변경 오류:', error);
      toast({
        title: '네트워크 오류',
        description: '비밀번호 변경 요청 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setChangingPassword(false);
    }
  };

  // 나중에 변경 처리
  const handleSkipPasswordChange = () => {
    // 모달 닫기 및 상태 초기화
    onClose();
    setNewPassword('');
    setConfirmPassword('');

    // 비밀번호 변경 없이 로그인 완료 처리 (다음 로그인 시에도 팝업 표시됨)
    authLogin(pendingLoginData.token, pendingLoginData.user, true); // needsPasswordChange를 true로 유지

    toast({
      title: '로그인 완료',
      description: '다음 로그인 시에도 비밀번호 변경을 권장합니다.',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });

    // 리다이렉트 처리
    if (pendingLoginData.redirect) {
      router.push(pendingLoginData.redirect);
    } else if (pendingLoginData.user.is_student) {
      router.push('/clinic/reserve');
    } else {
      router.push('/');
    }
  };

  // 로그인 폼 제출 처리
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 입력값 유효성 검사
    if (!username || !password) {
      toast({
        title: '입력 오류',
        description: '아이디와 비밀번호를 모두 입력해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      setLoading(true);
      
      // API 로그인 요청
      const data = await login(username, password);
      
      // 디버깅을 위한 콘솔 출력
      console.log('로그인 응답 데이터:', data);
      console.log('사용자 정보:', data.user);
      
      // 초기 비밀번호 변경이 필요한 경우 모달 표시
      if (data.needs_password_change) {
        console.log('초기 비밀번호 변경 필요 - 모달 표시');
        setPendingLoginData(data);
        onOpen();
        return;
      }

      // 인증 컨텍스트에 로그인 정보 저장
      authLogin(data.token, data.user, data.needs_password_change);
      
      toast({
        title: '로그인 성공',
        description: '환영합니다!',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      
      // 백엔드 응답의 redirect 경로 사용 또는 사용자 권한에 따른 리다이렉션
      if (data.redirect) {
        // 백엔드에서 제공한 리다이렉트 경로 사용
        console.log('백엔드 리다이렉트 경로:', data.redirect);
        router.push(data.redirect);
      } else {
        // 백엔드와 동일한 권한 로직 적용 (is_student 우선순위)
        console.log('클라이언트 사이드 권한 체크');
        if (data.user.is_superuser) {
          // 슈퍼유저는 메인 페이지로
          console.log('슈퍼유저 권한 - 메인 페이지로 이동');
          router.push('/');
        } else if (data.user.is_student) {
          // 학생은 클리닉 예약 페이지로 (우선순위 높음)
          console.log('학생 권한 - 클리닉 예약 페이지로 이동');
          router.push('/clinic/reserve');
        } else if (data.user.is_staff && !data.user.is_superuser && !data.user.is_student) {
          // 관리자는 학생 배치 페이지로 (학생이 아닌 경우만)
          console.log('관리자 권한 - 학생 배치 페이지로 이동');
          router.push('/student-placement');
        } else if (data.user.is_teacher) {
          // 강사는 마이페이지로
          console.log('강사 권한 - 마이페이지로 이동:', `/mypage/${data.user.id}`);
          router.push(`/mypage/${data.user.id}`);
        } else {
          // 기본 리다이렉션
          console.log('기본 리다이렉션 - 메인 페이지로 이동');
          router.push('/');
        }
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      toast({
        title: '로그인 실패',
        description: '아이디 또는 비밀번호가 올바르지 않습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="100vw" h="100vh">
      <Flex 
        h="100%" 
        w="100%" 
        justifyContent="center" 
        alignItems="center"
        flexDirection="column"
      >
        <Heading size="xl" mb={10} mt={-150} textAlign="center" fontWeight="normal">
          물리단
        </Heading>
        <Box 
          p={8} 
          width="100%" 
          maxW="400px" 
          border="1px solid rgb(198, 203, 210)" 
          borderRadius="lg" 
          bg="white"
        >
          <VStack spacing={6}>
            <Heading size="xl" mb={2} textAlign="center" fontWeight="normal">
              로그인
            </Heading>
            
            <form style={{ width: '100%' }} onSubmit={handleLogin}>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>아이디</FormLabel>
                  <Input 
                    type="text" 
                    value={username} 
                    border="1px solid rgb(198, 203, 210)" 
                    onChange={(e) => setUsername(e.target.value)} 
                    placeholder="아이디를 입력하세요"
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>비밀번호</FormLabel>
                  <InputGroup>
                    <Input 
                      type={showPassword ? 'text' : 'password'} 
                      value={password} 
                      border="1px solid rgb(198, 203, 210)" 
                      onChange={(e) => setPassword(e.target.value)} 
                      placeholder="비밀번호를 입력하세요"
                    />
                    <InputRightElement width="4.5rem">
                      <Button 
                        h="1.75rem" 
                        size="sm" 
                        onClick={handleShowPassword}
                      >
                        {showPassword ? <ViewOffIcon /> : <ViewIcon />}
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
                
                <Button 
                  width="100%"  
                  type="submit" 
                  border="1px solid rgb(127, 163, 213)"
                  isLoading={loading}
                  mt={4}
                >
                  로그인
                </Button>
              </VStack>
            </form>
            
            <Text fontSize="sm" color="gray.500">
              * 관리자에게 계정을 요청하세요
            </Text>
          </VStack>
        </Box>
      </Flex>

      {/* 초기 비밀번호 변경 모달 */}
      <Modal isOpen={isOpen} onClose={() => {}} isCentered closeOnOverlayClick={false}>
        <ModalOverlay bg="blackAlpha.300" />
        <ModalContent>
          <ModalHeader textAlign="center">
            초기 비밀번호를 변경해주세요!
          </ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>새 비밀번호</FormLabel>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요"
                  border="1px solid rgb(198, 203, 210)"
                />
              </FormControl>
              <FormControl>
                <FormLabel>새 비밀번호 확인</FormLabel>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호를 다시 입력하세요"
                  border="1px solid rgb(198, 203, 210)"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={handleSkipPasswordChange}
            >
              나중에 변경
            </Button>
            <Button
              colorScheme="blue"
              onClick={handlePasswordChange}
              isLoading={changingPassword}
              loadingText="변경 중..."
            >
              확인
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
} 