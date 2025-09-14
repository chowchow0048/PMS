'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Grid,
  GridItem,
  Button,
  Text,
  Badge,
  VStack,
  HStack,
  useToast,
  Spinner,
  Center,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useColorModeValue,
  Switch,
  FormControl,
  Tooltip,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/authContext';

// 의무 대상자 애니메이션 컴포넌트 (개선된 버전)
const MandatoryText: React.FC<{ delay: number }> = ({ delay }) => {
  // 랜덤 폰트 크기 생성 (1rem ~ 200px)
  const getRandomFontSize = () => {
    const minSize = 16; // 1rem = 16px
    const maxSize = 200; // 200px
    return Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
  };

  const fontSize = getRandomFontSize();
  const horizontalPosition = Math.random() * 80 + 10; // 10% ~ 90%

  return (
    <Text
      position="absolute"
      fontSize={`${fontSize}px`}
      fontWeight="bold"
      color="orange.500" // 주황색으로 변경
      zIndex={-1}
      left={`${horizontalPosition}%`}
      pointerEvents="none"
      userSelect="none"
      sx={{
        '@keyframes mandatoryFallFromSky': {
          '0%': {
            transform: 'translateY(-150vh) rotate(0deg)', // 더 높은 위치에서 시작
            opacity: 0.9,
          },
          '10%': {
            opacity: 0.8,
          },
          '90%': {
            opacity: 0.3,
          },
          '100%': {
            transform: 'translateY(100vh) rotate(360deg)',
            opacity: 0,
          },
        },
        animation: 'mandatoryFallFromSky 4s linear infinite', // 4초로 조금 더 길게
        animationDelay: `${delay}s`,
      }}
    >
      의무 대상자!!!
    </Text>
  );
};

// 타입 정의
interface Student {
  id: number;
  name: string;
  username: string;
}

interface ClinicSlot {
  clinic_id: number | null;
  teacher_name: string | null;
  subject: string | null;
  room: string | null;
  capacity: number;
  current_count: number;
  remaining_spots: number;
  is_full: boolean;
  students: Student[];
}

interface WeeklySchedule {
  [day: string]: {
    [time: string]: ClinicSlot;
  };
}

interface ScheduleResponse {
  schedule: WeeklySchedule;
  days: string[];
  times: string[];
  total_clinics: number;
}

const ClinicReservePage: React.FC = () => {
  // 상태 관리
  const [schedule, setSchedule] = useState<WeeklySchedule>({});
  const [days, setDays] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    day: string;
    time: string;
    clinic: ClinicSlot;
    action: 'reserve';  // 예약만 가능 (취소는 불가능)
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>(''); // 타이머 상태
  const [essentialClinic, setEssentialClinic] = useState<boolean>(true); // 의무 클리닉 신청 상태 (초기값은 user 데이터 로드 후 업데이트)
  const [updatingEssential, setUpdatingEssential] = useState<boolean>(false); // 의무 클리닉 업데이트 로딩
  
  // 모달 및 유틸리티
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isTooltipOpen, onOpen: onTooltipOpen, onClose: onTooltipClose } = useDisclosure();
  const { user, token, isLoading, updateUser } = useAuth();
  const toast = useToast();

  // 의무 대상자 애니메이션을 위한 상태
  const [showMandatoryAnimation, setShowMandatoryAnimation] = useState(false);

  // 다크모드 색상 값
  const bgColor = useColorModeValue('white', 'dark.background');
  const textColor = useColorModeValue('gray.800', 'dark.text');
  const cardBg = useColorModeValue('white', 'dark.background');
  const borderColor = useColorModeValue('gray.200', 'dark.border');
  const secondaryTextColor = useColorModeValue('gray.600', 'dark.textSecondary');

  // 요일 매핑
  const dayNames: { [key: string]: string } = {
    mon: '월',
    tue: '화',
    wed: '수',
    thu: '목',
    fri: '금',
    sat: '토',
  };

  // 요일 축약형 매핑 (md 이상에서 사용)
  const dayNamesShort: { [key: string]: string } = {
    mon: '월',
    tue: '화',
    wed: '수',
    thu: '목',
    fri: '금',
    sat: '토',
  };

  // 요일 순서 매핑 (월요일부터 토요일까지)
  const dayOrder: { [key: string]: number } = {
    mon: 0,
    tue: 1,
    wed: 2,
    thu: 3,
    fri: 4,
    sat: 5,
  };

  // 현재 요일 확인 함수
  const getCurrentDayOrder = () => {
    const today = new Date();
    const weekday = today.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
    
    
    // 일요일(0)을 토요일 다음(6)으로 처리
    if (weekday === 0) return 6; // 일요일은 모든 요일 예약 가능
    return weekday - 1; // 월요일(1) -> 0, 화요일(2) -> 1, ...
  };

  const getCurrentDay = () => {
    const today = new Date();
    const weekday = today.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
    
    const dayMapping = {
      0: 'sun',  // 일요일
      1: 'mon',  // 월요일
      2: 'tue',  // 화요일
      3: 'wed',  // 수요일
      4: 'thu',  // 목요일
      5: 'fri',  // 금요일
      6: 'sat'   // 토요일
    };
    
    return dayMapping[weekday as keyof typeof dayMapping];
  };

  // 특정 요일이 예약 가능한지 확인하는 함수
  const isDayReservable = (day: string) => {
    const currentDayOrder = getCurrentDayOrder();
    const targetDayOrder = dayOrder[day];
    
    // 현재 요일보다 이전 요일은 예약 불가
    return targetDayOrder >= currentDayOrder;
  };


  // 다음주 월요일 00:00까지의 시간 계산 함수 (24시간계)
  const getTimeUntilNextMonday = () => {
    const now = new Date();
    const nextMonday = new Date();
    
    // 다음주 월요일 계산
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7; // 일요일=0, 월요일=1
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0); // 00:00:00으로 설정
    
    const timeDiff = nextMonday.getTime() - now.getTime();
    
    if (timeDiff <= 0) return '00:00:00';
    
    // 전체 시간을 시:분:초로 계산 (일수를 시간으로 변환)
    const totalHours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    return `${totalHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 초기 데이터 로드 (인증 완료 후)
  useEffect(() => {
    if (!isLoading && token) {
      loadWeeklySchedule();
      
      // 의무 대상자인 경우 애니메이션 표시
      if (user?.non_pass) {
        setShowMandatoryAnimation(true);
      }
      
      // 사용자의 의무 클리닉 신청 상태 초기화
      console.log('🔍 [clinic/reserve] user 데이터:', user);
      console.log('🔍 [clinic/reserve] user.essential_clinic:', user?.essential_clinic);
      
      if (user?.essential_clinic !== undefined) {
        console.log('✅ [clinic/reserve] essential_clinic 상태 설정:', user.essential_clinic);
        setEssentialClinic(user.essential_clinic);
      } else {
        console.log('⚠️ [clinic/reserve] user.essential_clinic이 undefined입니다. 서버에서 최신 데이터 가져오기');
        // localStorage의 기존 사용자 데이터에 essential_clinic 필드가 없는 경우
        // 서버에서 최신 사용자 데이터를 가져와서 업데이트
        fetchUserData();
      }
    }
  }, [token, isLoading, user]);

  // 타이머 업데이트 (1초마다)
  useEffect(() => {
    const updateTimer = () => {
      setTimeLeft(getTimeUntilNextMonday());
    };
    
    // 초기 설정
    updateTimer();
    
    // 1초마다 업데이트
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // 주간 스케줄 로드
  const loadWeeklySchedule = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinics/weekly_schedule/`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('스케줄을 불러오는데 실패했습니다.');
      }

      const data: ScheduleResponse = await response.json();
      setSchedule(data.schedule);
      setDays(data.days);
      setTimes(data.times);
    } catch (error) {
        toast({
        title: '오류',
        description: '스케줄을 불러오는데 실패했습니다.',
        status: 'error',
        duration: 1000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 클리닉 예약 처리
  const handleReserveClinic = async (day: string, time: string, clinic: ClinicSlot) => {

    if (!user) {
      toast({
        title: '로그인 필요',
        description: '로그인 후 이용해주세요.',
        status: 'error',
        duration: 1000,
        isClosable: true,
      });
      return;
    }

    // 이전 요일 예약 불가 체크
    if (!isDayReservable(day)) {
      toast({
        title: '예약 불가',
        description: `${dayNames[day]}은 이미 지나간 요일로 예약할 수 없습니다.`,
        status: 'warning',
        duration: 1000,
        isClosable: true,
      });
      return;
    }

    if (!clinic.clinic_id) {
      toast({
        title: '예약 불가',
        description: '해당 시간대에 클리닉이 없습니다.',
        status: 'warning',
        duration: 1000,
        isClosable: true,
      });
      return;
    }

    if (clinic.is_full) {
      // alertOccupied 기능 - 마감된 클리닉
      toast({
        title: '예약 마감',
        description: '해당 시간대는 이미 마감되었습니다.',
        status: 'warning',
        duration: 1000,
        isClosable: true,
      });
      return;
    }

    // 이미 예약되어 있는지 확인
    const isAlreadyReserved = clinic.students.some(
      student => student.id === user.id
    );

    if (isAlreadyReserved) {
      toast({
        title: '이미 예약됨',
        description: '이미 해당 클리닉에 예약되어 있습니다.',
        status: 'info',
        duration: 1000,
        isClosable: true,
      });
      return;
    }

    // 예약 확인 모달 표시
    setSelectedSlot({ day, time, clinic, action: 'reserve' });
    onOpen();
  };

  // 예약 확정 처리
  const confirmReservation = async () => {
    if (!selectedSlot || !user) return;

    // 예약 취소는 불가능하므로 해당 로직 제거

    try {
      setReserving(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinics/reserve_clinic/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          clinic_id: selectedSlot.clinic.clinic_id,
        }),
      });

      const data = await response.json();

                  if (response.ok) {
              // 예약 성공
              const isWasMandatory = user?.non_pass; // 예약 전 의무 대상자 상태 확인
              
              toast({
                title: '예약 완료',
                description: isWasMandatory 
                  ? `${data.message} 의무 클리닉 상태가 해제되었습니다!` 
                  : data.message,
                status: 'success',
                duration: isWasMandatory ? 3000 : 1000,
                isClosable: true,
              });

              // 의무 대상자였다면 애니메이션 중지
              if (isWasMandatory) {
                setShowMandatoryAnimation(false);
              }

              // 스케줄 새로고침
              await loadWeeklySchedule();
              onClose();
            } else if (response.status === 409 && data.error === 'occupied') {
              // 마감된 경우 (alertOccupied)
              toast({
                title: '예약 마감',
                description: data.message,
                status: 'warning',
                duration: 1000,
                isClosable: true,
              });
              onClose();
              await loadWeeklySchedule(); // 최신 상태로 업데이트
            } else if (response.status === 403 && data.error === 'no_show_blocked') {
              // 노쇼로 인한 예약 차단
              toast({
                title: '예약 제한',
                description: data.message || `${data.user_name || '학생'}은 ${data.no_show_count || 2}회 이상 무단결석하여 금주 보충 예약이 불가능합니다.`,
                status: 'error',
                duration: 1000, // 길게 표시
                isClosable: true,
              });
              onClose();
            } else if (response.status === 400 && data.error === 'reservation_closed') {
              // 예약 기간이 아닌 경우
              toast({
                title: '예약 불가',
                description: '보충 예약 가능 기간이 아닙니다.',
                status: 'warning',
                duration: 1000,
                isClosable: true,
              });
              onClose();
            } else {
              // 기타 오류
              toast({
                title: '예약 실패',
                description: data.error || '예약 중 오류가 발생했습니다.',
                status: 'error',
                duration: 1000,
                isClosable: true,
              });
            }
    } catch (error) {
        toast({
        title: '네트워크 오류',
        description: '예약 요청 중 오류가 발생했습니다.',
        status: 'error',
        duration: 1000,
        isClosable: true,
      });
    } finally {
      setReserving(false);
    }
  };

  // 예약된 클리닉 클릭 시 관리자 문의 안내
  const handleReservedClinicClick = () => {
    toast({
      title: '예약 취소 불가',
      description: '예약 취소는 관리자에게 문의하세요!',
      status: 'info',
      duration: 1000,
      isClosable: true,
    });
  };

  // 사용자 데이터 최신화 함수 (essential_clinic 필드가 없는 경우 사용)
  const fetchUserData = async () => {
    if (!user || !token) return;

    try {
      console.log('🔍 [clinic/reserve] 서버에서 최신 사용자 데이터 가져오는 중...');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/users/${user.id}/`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const updatedUser = await response.json();
        console.log('✅ [clinic/reserve] 최신 사용자 데이터:', updatedUser);
        
        if (updatedUser.essential_clinic !== undefined) {
          setEssentialClinic(updatedUser.essential_clinic);
          console.log('✅ [clinic/reserve] essential_clinic 상태 업데이트:', updatedUser.essential_clinic);
          
          // AuthContext와 localStorage의 사용자 데이터 업데이트
          updateUser(updatedUser);
          console.log('✅ [clinic/reserve] 사용자 데이터 업데이트 완료');
        } else {
          console.log('⚠️ [clinic/reserve] 서버 데이터에도 essential_clinic 필드가 없습니다. 기본값 true 사용');
          setEssentialClinic(true);
        }
      } else {
        console.error('❌ [clinic/reserve] 사용자 데이터 가져오기 실패:', response.status);
        // 서버에서 데이터를 가져올 수 없는 경우 기본값 사용
        setEssentialClinic(true);
      }
    } catch (error) {
      console.error('❌ [clinic/reserve] 사용자 데이터 가져오기 오류:', error);
      // 오류 발생 시 기본값 사용
      setEssentialClinic(true);
    }
  };

  // 의무 클리닉 신청 상태 토글
  const handleToggleEssentialClinic = async (newValue: boolean) => {
    if (!user || !token) return;

    try {
      setUpdatingEssential(true);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/users/${user.id}/update_essential_clinic/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          essential_clinic: newValue
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ [clinic/reserve] 서버 응답 성공:', data);
        setEssentialClinic(newValue);
        console.log('✅ [clinic/reserve] 로컬 상태 업데이트:', newValue);
        
        // 서버에서 최신 사용자 데이터 가져와서 AuthContext 업데이트 (non_pass 상태도 함께 업데이트)
        await fetchUserData();
        
        toast({
          title: '변경 완료',
          description: `의무 클리닉 신청이 ${newValue ? '설정' : '해제'}되었습니다.`,
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      } else {
        toast({
          title: '변경 실패',
          description: data.error || '상태 변경 중 오류가 발생했습니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('의무 클리닉 상태 업데이트 오류:', error);
      toast({
        title: '네트워크 오류',
        description: '상태 변경 요청 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setUpdatingEssential(false);
    }
  };

  // 슬롯 렌더링 - 모바일 최적화
  const renderSlot = (day: string, time: string) => {
    const clinic = schedule[day]?.[time];
    if (!clinic) return null;

    const isReserved = user && clinic.students.some(student => student.id === user.id);
    const hasClinic = clinic.clinic_id !== null;
    const isPastDay = !isDayReservable(day); // 이전 요일인지 확인

    return (
      <GridItem key={`${day}-${time}`}>
        <Box
          // 모바일에서 더 큰 패딩 설정
          p={{ base: 0.5, md: 1 }}
          width="100%"
          // 정사각형으로 고정
          aspectRatio={1}
          border="1px solid"
          borderColor={
            hasClinic ? isReserved ? "green.300" : borderColor : useColorModeValue("gray.100", "dark.border")
          }
          borderRadius="md"
          bg={
            !hasClinic
              ? useColorModeValue("gray.50", "dark.background")
              : isPastDay
              ? useColorModeValue("gray.100", "dark.background")
              : isReserved
              ? useColorModeValue("green.50", "rgba(16, 147, 27, 0.13)")
              : clinic.is_full
              ? useColorModeValue("red.50", "rgba(244, 63, 94, 0.1)")
              : cardBg
          }
          _hover={{
            shadow: hasClinic && !clinic.is_full && !isPastDay && !isReserved ? "md" : "none",
            cursor: hasClinic && !isPastDay && !isReserved && !clinic.is_full ? "pointer" : isReserved ? "pointer" : "default",
          }}
          transition="all 0.2s"
          onClick={() => {
            if (hasClinic && !isPastDay) {
              if (isReserved) {
                // 예약된 클리닉 클릭 시 관리자 문의 안내
                handleReservedClinicClick();
              } else if (!clinic.is_full) {
                handleReserveClinic(day, time, clinic);
              }
            }
          }}
          // 터치 영역 확대를 위한 스타일
          position="relative"
          role="button"
          tabIndex={hasClinic && !clinic.is_full && !isPastDay ? 0 : -1}
        >
          <Box position="relative" height="100%" display="flex" flexDirection="column">
            {hasClinic ? (
              <>
                {/* 시간과 요일 표시 - 최상단 */}
                <HStack justify="space-between" align="flex-start" mb={1}>
                  <Text 
                    // sm 이하에서 더 작은 텍스트
                    fontSize={{ base: "0.6rem", sm: "xs", md: "sm" }}
                    // color={secondaryTextColor}
                    color={"white.600"}
                    fontWeight="bold"
                    lineHeight="1.2"
                  >
                    {time}
                  </Text>
                  <Text 
                    fontSize={{ base: "0.6rem", sm: "xs", md: "xs" }}
                    color={"white.600"}
                    fontWeight="bold"
                    lineHeight="1.2"
                  >
                    {/* md 이상에서는 축약형, 그 이하에서는 전체 */}
                    <Box display={{ base: "block", md: "none" }}>{dayNames[day]}</Box>
                    <Box display={{ base: "none", md: "block" }}>{dayNamesShort[day]}</Box>
                  </Text>
                </HStack>
                
                {/* 예약됨 뱃지 영역 - 고정 높이로 레이아웃 안정화 */}
                <Box
                  height="1.2rem" // 뱃지 영역 고정 높이
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  mb={0.5}
                >
                  {isReserved && (
                    <Badge 
                      colorScheme="green"
                      fontSize={{ base: "0.6rem", sm: "0.8rem", md: "0.8rem" }}
                      px={0.8}
                      py={0.2}
                    >
                      예약됨
                    </Badge>
                  )}
                </Box>
                
                {/* 정가운데 인원수 표시 또는 마감 표시 */}
                <Box
                  flex="1"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                                     {isPastDay ? (
                     <Text
                       // sm 이하에서 더 작은 텍스트
                       fontSize={{ base: "0.6rem", sm: "sm", md: "sm" }}
                       fontWeight="bold"
                       textAlign="center"
                       color={useColorModeValue("gray.500", "dark.textSecondary")}
                     >
                       마감
                     </Text>
                   ) : (
                     <Text
                       // sm 이하에서 더 작은 텍스트 (인원수는 가장 중요한 정보)
                       fontSize={{ base: "0.7rem", sm: "0.8rem", md: "0.8rem" }}
                       fontWeight="bold"
                       textAlign="center"
                       color={
                         clinic.is_full 
                           ? useColorModeValue("red.500", "red.400") 
                           : clinic.remaining_spots <= 3 
                           ? useColorModeValue("orange.500", "orange.400") 
                           : useColorModeValue("green.600", "green.400")
                       }
                     >
                       {clinic.current_count}/{clinic.capacity}
                     </Text>
                   )}
                </Box>
                
                                 {/* 마감 표시 - 하단 중앙 */}
                 {/* ㅓ */}
              </>
            ) : (
                             <Center height="100%">
                 <Text 
                   fontSize={{ base: "xs", sm: "xs", md: "xs" }}
                   color={useColorModeValue("gray.400", "dark.textSecondary")}
                   textAlign="center"
                 >
                   클리닉 없음
                 </Text>
               </Center>
            )}
          </Box>
        </Box>
      </GridItem>
    );
  };

  if (loading || isLoading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center>
          <VStack spacing={4}>
            <Spinner size="xl" />
            <Text>스케줄을 불러오는 중...</Text>
          </VStack>
        </Center>
      </Container>
    );
  }

  return (
    <Container 
      maxW="container.xl" 
      py={{ base: 2, md: 4 }} 
      px={{ base: 2, md: 4 }}
      position="relative"
      overflow="hidden"
    >
      
      <VStack spacing={4} align="stretch">
        <VStack spacing={2} textAlign="center">
          <Heading 
            as="h1" 
            size={{ base: "lg", md: "md" }}
            fontWeight="bold"
            color={"white.600"}
          >
            보충 예약
          </Heading>
          
          {/* 의무 클리닉 신청 Toggle 버튼 */}
          <FormControl 
            display="flex" 
            alignItems="center" 
            justifyContent="center"
            maxW="md"
            mx="auto"
            mb={2}
          >
            <Tooltip
              label="희망하는 학생에 한하여 의무 클리닉을 해제할 수 있습니다. 의무 클리닉 해제 시, 클리닉을 예약하지 않아도 페널티가 부과되지 않습니다."
              placement="top"
              hasArrow
              bg="gray.900"
              color="white"
              borderRadius="md"
              fontSize="xs"
              maxW="300px"
              textAlign="center"
              left={3}
              p={3}
              isOpen={isTooltipOpen}
              onClose={onTooltipClose}
            >
              <Text
                fontSize={{ base: "sm", md: "md" }}
                color={textColor}
                mr={3}
                cursor="help"
                onClick={onTooltipOpen}
                textDecoration="underline"
                textDecorationStyle="dotted"
                textUnderlineOffset="2px"
                _hover={{ opacity: 0.8 }}
              >
                클리닉 의무화
              </Text>
            </Tooltip>
            <Switch
              id="essential-clinic-switch"
              isChecked={essentialClinic}
              onChange={(e) => handleToggleEssentialClinic(e.target.checked)}
              isDisabled={updatingEssential}
              colorScheme="blue"
              size="md"
            />
          </FormControl>
          
          <Text 
            fontSize={{ base: "md", md: "lg" }}
            color={useColorModeValue("green.500", "green.400")}
            fontWeight="bold"
            maxW="md"
            mx="auto"
            lineHeight="1.6"
          >
            초기화 까지 남은시간 {timeLeft}
          </Text>
        </VStack>
      
        {/* 동적 n*m 그리드 (시간 x 요일) - 모바일 최적화 */}
        <Box 
          overflowX="auto"
          display="flex"
          justifyContent="center"
          alignItems="center"
          // 모바일에서 여백 조정
          px={{ base: 0.5, md: 0 }}
        >
          <Grid
            // 반응형 그리드: base~md에서는 시간별 컬럼, md 이상에서는 요일별 컬럼
            templateColumns={{ 
              base: `repeat(${times.length}, 1fr)`,  // 모바일: 시간별 컬럼
              md: `repeat(${days.length}, 1fr)`      // 데스크톱: 요일별 컬럼
            }}
            // 셀 사이 간격 1rem으로 고정
            columnGap="1rem"
            rowGap="1rem"
            // 컨테이너 크기를 디바이스별로 조정
            w="100%"
            maxW={{ base: "100%", md: "800px" }}
            // 모바일에서 최소 너비 보장
            minW={{ base: "200px", md: "auto" }}
          >
            {/* 반응형 그리드 렌더링 */}
            <Box display={{ base: "contents", md: "none" }}>
              {/* 모바일: 요일별로 행 구성 (월, 화, 수, 목, 금, 토) */}
              {days.map(day => (
                <React.Fragment key={day}>
                  {times.map(time => renderSlot(day, time))}
                </React.Fragment>
              ))}
            </Box>
            
            <Box display={{ base: "none", md: "contents" }}>
              {/* 데스크톱: 시간별로 행 구성 (기존 방식) */}
              {times.map(time => (
                <React.Fragment key={time}>
                  {days.map(day => renderSlot(day, time))}
                </React.Fragment>
              ))}
            </Box>
          </Grid>
        </Box>
      </VStack>

      {/* 예약 확인 모달 - 모바일 최적화 */}
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        isCentered
        // 모바일에서 더 작은 크기와 여백
        size={{ base: "sm", md: "md" }}
        motionPreset="slideInBottom"
      >
        <ModalOverlay bg="blackAlpha.300" />
        <ModalContent 
          // 모바일에서 화면 가장자리 여백
          mx={{ base: 4, md: 0 }}
          my={{ base: 4, md: 0 }}
          bg={cardBg}
          color={textColor}
        >
          {selectedSlot && (
            <>
              <ModalBody pt={6} px={{ base: 4, md: 6 }}>
                <Text
                  textAlign="center"
                  fontSize={{ base: "lg", md: "md" }}
                  fontWeight="bold"
                  mb={4}
                  lineHeight="1.5"
                >
                  예약 확인
                </Text>
                <Text 
                  textAlign="center" 
                  // 모바일에서 더 큰 텍스트
                  fontSize={{ base: "lg", md: "md" }}
                  mb={4}
                  lineHeight="1.5"
                >
                  {selectedSlot.day === getCurrentDay() ? "당일 보충 예약 취소는 불가능합니다. 예약 하시겠습니까?" : `${dayNames[selectedSlot.day]} ${selectedSlot.time} 예약 하시겠습니까?`}
                </Text>
              </ModalBody>
              <ModalFooter px={{ base: 4, md: 6 }}>
                <Button 
                  variant="ghost" 
                  mr={3} 
                  onClick={onClose}
                  // 모바일에서 더 큰 버튼
                  size={{ base: "md", md: "sm" }}
                >
                  닫기
                </Button>
                <Button
                  colorScheme="blue"
                  onClick={confirmReservation}
                  isLoading={reserving}
                  loadingText="예약 중..."
                  size={{ base: "md", md: "sm" }}
                >
                  예약 확정
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default ClinicReservePage; 