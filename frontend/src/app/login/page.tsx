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
  Text
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

  // Next.js 라우터와 인증 상태 관리
  const router = useRouter();
  const toast = useToast();
  const { login: authLogin, isAuthenticated } = useAuth();

  // 이미 로그인된 사용자 리다이렉트 처리
  useEffect(() => {
    if (isAuthenticated) {
      // 이미 로그인된 경우 학생배치 페이지로 이동
      router.push('/student-placement');
    }
  }, [isAuthenticated, router]);

  // 비밀번호 표시/숨김 토글 핸들러
  const handleShowPassword = () => setShowPassword(!showPassword);

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
      
      // 인증 컨텍스트에 로그인 정보 저장
      authLogin(data.token, data.user);
      
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
        // 백엔드와 동일한 권한 로직 적용
        console.log('클라이언트 사이드 권한 체크');
        if (data.user.is_superuser || data.user.is_staff) {
          // 슈퍼유저나 관리자는 학생 배치 페이지로
          console.log('관리자 권한 - 학생 배치 페이지로 이동');
          router.push('/student-placement');
        } else if (data.user.is_teacher && !data.user.is_staff && !data.user.is_superuser) {
          // 일반 강사(관리자가 아닌)는 마이페이지로
          console.log('강사 권한 - 마이페이지로 이동:', `/mypage/${data.user.id}`);
          router.push(`/mypage/${data.user.id}`);
        } else {
          // 기본 리다이렉션
          console.log('기본 리다이렉션 - 학생 배치 페이지로 이동');
          router.push('/student-placement');
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
      >
        <Box 
          p={8} 
          width="100%" 
          maxW="400px" 
          border="1px solid rgb(198, 203, 210)" 
          borderRadius="lg" 
          bg="white"
        >
          <VStack spacing={6}>
            <Heading size="xl" mb={2} textAlign="center">
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
    </Container>
  );
} 