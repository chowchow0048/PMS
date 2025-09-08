'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Box, 
  Flex, 
  Text, 
  Button, 
  HStack, 
  IconButton, 
  useDisclosure, 
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  VStack,
  useBreakpointValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  useToast,
  useColorModeValue,
} from '@chakra-ui/react';
import { HamburgerIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useAuth } from '@/lib/authContext';
import ThemeToggleButton from '@/components/ThemeToggleButton';

// 네비게이션 아이템 인터페이스
interface NavItem {
  label: string;
  href: string;
  requireAuth?: boolean; // 인증이 필요한지 여부
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter(); // 라우터 훅 추가
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const toast = useToast();
  
  // 인증 상태 사용
  const { user, isAuthenticated, logout } = useAuth();
  
  // Material Design 다크테마 색상 설정
  const navBg = useColorModeValue(
    'rgba(0, 0, 0, 0.85)', // 라이트 모드
    'dark.surface'          // 다크 모드: #1F1F1F
  );
  const textColor = useColorModeValue('white', 'dark.text');
  const buttonHoverBg = useColorModeValue(
    'rgba(255, 255, 255, 0.1)', // 라이트 모드
    'dark.hover'                  // 다크 모드: #2D2E30
  );

  // 마이페이지 클릭 핸들러 (학생용 - 아직 미구현)
  const handleStudentMyPage = () => {
    toast({
      title: 'mypage',
      description: '마이페이지 기능이 아직 구현되지 않았습니다.',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  return (
    <Box 
      as="nav" 
      bg={navBg}
      px={4} 
      boxShadow="md"
      position="static"
      width="100%"
      height="60px"
      display="flex"
      alignItems="center"
    >
      <Flex 
        w="100%" 
        alignItems="center" 
        justifyContent="space-between"
      >
        <Link href="/" passHref>
          <Text fontSize="xl" fontWeight="bold" color={textColor} cursor="pointer">
            물리단
          </Text>
        </Link>

        {/* 데스크톱 뷰 */}
        {!isMobile ? (
          <HStack spacing={8} alignItems="center">
            {/* 다크모드 토글 버튼 */}
            <ThemeToggleButton size="sm" />
            
            {/* 왼쪽 네비게이션 버튼들 - 사용자 역할별 */}
            <HStack
              as="nav"
              spacing={4}
              display={{ base: 'none', md: 'flex' }}
            >
              {isAuthenticated && user?.is_student && (
                <>
                  <Button
                    color={textColor}
                    bg="transparent"
                    _hover={{ bg: buttonHoverBg }}
                    onClick={() => router.push('/clinic/reserve')}
                  >
                    클리닉 예약
                  </Button>
                  <Button
                    color={textColor}
                    bg="transparent"
                    _hover={{ bg: buttonHoverBg }}
                    onClick={handleStudentMyPage}
                  >
                    마이페이지
                  </Button>
                </>
              )}
              
              {isAuthenticated && user?.is_staff && (
                <>
                  <Button
                    color={textColor}
                    bg="transparent"
                    _hover={{ bg: buttonHoverBg }}
                    onClick={() => router.push('/student-placement')}
                  >
                    학생 관리
                  </Button>
                  <Button
                    color={textColor}
                    bg="transparent"
                    _hover={{ bg: buttonHoverBg }}
                    onClick={() => router.push('/clinic/today')}
                  >
                    오늘의 보충
                  </Button>
                  <Button
                    color={textColor}
                    bg="transparent"
                    _hover={{ bg: buttonHoverBg }}
                    onClick={() => router.push('/clinic/reserve')}
                  >
                    클리닉 예약
                  </Button>
                  <Button
                    color={textColor}
                    bg="transparent"
                    _hover={{ bg: buttonHoverBg }}
                    onClick={() => router.push(`/mypage/${user?.id}`)}
                  >
                    마이페이지
                  </Button>
                </>
              )}
            </HStack>
            
            {isAuthenticated ? (
              <Menu>
                <MenuButton
                  as={Button}
                  color={textColor}
                  bg={useColorModeValue('rgba(0, 0, 0, 0.6)', 'dark.surface')}
                  _hover={{
                    bg: buttonHoverBg,
                  }}
                  _active={{
                    bg: useColorModeValue('rgba(0, 0, 0, 0.8)', 'dark.hover'),
                  }}
                  rightIcon={<ChevronDownIcon />}
                >
                  {user?.name || user?.user_name || user?.username}
                </MenuButton>
                <MenuList>
                  {/* 관리자/슈퍼유저만 학생 배치 페이지 접근 가능 */}
                  {(user?.is_superuser || user?.is_staff) && (
                    <MenuItem 
                      onClick={() => router.push('/student-placement')}
                    >
                      학생 관리
                    </MenuItem>
                  )}
                  
                  {/* <MenuItem 
                    onClick={() => router.push(`/mypage/${user?.id}`)}
                  >
                    마이페이지
                  </MenuItem> */}
                  <MenuDivider/>
                  
                  <MenuItem
                    onClick={() => router.push('/clinic')}
                  >
                    오늘의 클리닉
                  </MenuItem>
                  
                  <MenuDivider/>
                  
                  <MenuItem 
                    onClick={logout}
                  >
                    로그아웃
                  </MenuItem>
                </MenuList>
              </Menu>
            ) : null}
          </HStack>
        ) : (
          // 모바일 뷰 (햄버거 메뉴와 다크모드 토글)
          <HStack spacing={2}>
            <ThemeToggleButton size="sm" />
            <IconButton
              aria-label="메뉴 열기"
              icon={<HamburgerIcon />}
              variant="outline"
              colorScheme="whiteAlpha"
              onClick={onOpen}
            />
          </HStack>
        )}
      </Flex>

      {/* 모바일 드로어 메뉴 */}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">메뉴</DrawerHeader>
          <DrawerBody>
            <VStack spacing={0} align="stretch" marginBottom={0}>
              {/* 학생용 메뉴 */}
              {isAuthenticated && user?.is_student && (
                <>
                  <Box py={4} borderBottomWidth="1px">
                    <Button
                      w="full"
                      variant="ghost"
                      onClick={() => {
                        router.push('/clinic/reserve');
                        onClose();
                      }}
                    >
                      클리닉 예약
                    </Button>
                  </Box>
                  <Box py={4} borderBottomWidth="1px">
                    <Button
                      w="full"
                      variant="ghost"
                      onClick={() => {
                        handleStudentMyPage();
                        onClose();
                      }}
                    >
                      마이페이지
                    </Button>
                  </Box>
                </>
              )}
              
              {/* 관리자용 메뉴 */}
              {isAuthenticated && user?.is_staff && (
                <>
                  <Box py={4} borderBottomWidth="1px">
                    <Button
                      w="full"
                      variant="ghost"
                      onClick={() => {
                        router.push('/student-placement');
                        onClose();
                      }}
                    >
                      학생 관리
                    </Button>
                  </Box>
                  <Box py={4} borderBottomWidth="1px">
                    <Button
                      w="full"
                      variant="ghost"
                      onClick={() => {
                        router.push('/clinic/today');
                        onClose();
                      }}
                    >
                      오늘의 보충
                    </Button>
                  </Box>
                  <Box py={4} borderBottomWidth="1px">
                    <Button
                      w="full"
                      variant="ghost"
                      onClick={() => {
                        router.push('/clinic/reserve');
                        onClose();
                      }}
                    >
                      클리닉 예약
                    </Button>
                  </Box>
                  <Box py={4} borderBottomWidth="1px">
                    <Button
                      w="full"
                      variant="ghost"
                      onClick={() => {
                        router.push(`/mypage/${user?.id}`);
                        onClose();
                      }}
                    >
                      마이페이지
                    </Button>
                  </Box>
                </>
              )}
              
              {/* 로그아웃 버튼 */}
              {isAuthenticated && (
                <Box py={4}>
                  <Button
                    w="full"
                    colorScheme="red"
                    onClick={() => {
                      logout();
                      onClose();
                    }}
                  >
                    로그아웃
                  </Button>
                </Box>
              )}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}