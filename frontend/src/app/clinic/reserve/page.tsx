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
} from '@chakra-ui/react';
import { useAuth } from '@/lib/authContext';

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
    action: 'reserve' | 'cancel';  // 예약 또는 취소 구분
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>(''); // 타이머 상태
  
  // 모달 및 유틸리티
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user, token, isLoading } = useAuth();
  const toast = useToast();

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
    
    // 테스팅용: 월요일로 가정
    // return 0; // 월요일로 고정
    
    // 일요일(0)을 토요일 다음(6)으로 처리
    if (weekday === 0) return 6; // 일요일은 모든 요일 예약 가능
    return weekday - 1; // 월요일(1) -> 0, 화요일(2) -> 1, ...
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
    }
  }, [token, isLoading]);

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
      // console.error('스케줄 로드 오류:', error);
      toast({
        title: '오류',
        description: '스케줄을 불러오는데 실패했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 클리닉 예약 처리
  const handleReserveClinic = async (day: string, time: string, clinic: ClinicSlot) => {
    // 모든 사용자가 예약 가능하도록 수정 (학생 < 강사 < 관리자 < 슈퍼유저)
    // if (!user || !user.is_student) {  // 보충 시스템 개편으로 주석처리
    //   toast({
    //     title: '권한 없음',
    //     description: '학생만 예약할 수 있습니다.',
    //     status: 'error',
    //     duration: 3000,
    //     isClosable: true,
    //   });
    //   return;
    // }

    if (!user) {
      toast({
        title: '로그인 필요',
        description: '로그인 후 이용해주세요.',
        status: 'error',
        duration: 3000,
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
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!clinic.clinic_id) {
      toast({
        title: '예약 불가',
        description: '해당 시간대에 클리닉이 없습니다.',
        status: 'warning',
        duration: 3000,
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
        duration: 3000,
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
        duration: 3000,
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

    if (selectedSlot.action === 'cancel') {
      // 예약 취소 처리
      return handleCancelReservation(selectedSlot.day, selectedSlot.time, selectedSlot.clinic);
    }

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
              toast({
                title: '예약 완료',
                description: data.message,
                status: 'success',
                duration: 3000,
                isClosable: true,
              });

              // 스케줄 새로고침
              await loadWeeklySchedule();
              onClose();
            } else if (response.status === 409 && data.error === 'occupied') {
              // 마감된 경우 (alertOccupied)
              toast({
                title: '예약 마감',
                description: data.message,
                status: 'warning',
                duration: 3000,
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
                duration: 8000, // 길게 표시
                isClosable: true,
              });
              onClose();
            } else if (response.status === 400 && data.error === 'reservation_closed') {
              // 예약 기간이 아닌 경우
              toast({
                title: '예약 불가',
                description: '보충 예약 가능 기간이 아닙니다.',
                status: 'warning',
                duration: 5000,
                isClosable: true,
              });
              onClose();
            } else {
              // 기타 오류
              toast({
                title: '예약 실패',
                description: data.error || '예약 중 오류가 발생했습니다.',
                status: 'error',
                duration: 3000,
                isClosable: true,
              });
            }
    } catch (error) {
      // console.error('예약 오류:', error);
      toast({
        title: '네트워크 오류',
        description: '예약 요청 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setReserving(false);
    }
  };

  // 예약 취소 처리
  const handleCancelReservation = async (day: string, time: string, clinic: ClinicSlot) => {
    if (!user || !clinic.clinic_id) return;

    const isReserved = clinic.students.some(student => student.id === user.id);
    if (!isReserved) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinics/cancel_reservation/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          clinic_id: clinic.clinic_id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: '취소 완료',
          description: data.message,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        // 스케줄 새로고침
        await loadWeeklySchedule();
        onClose(); // 모달 닫기
      } else {
        toast({
          title: '취소 실패',
          description: data.error || '취소 중 오류가 발생했습니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      // console.error('취소 오류:', error);
      toast({
        title: '네트워크 오류',
        description: '취소 요청 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
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
          borderColor={hasClinic ? "gray.200" : "gray.100"}
          borderRadius="md"
          bg={
            !hasClinic
              ? "gray.50"
              : isPastDay
              ? "gray.100"
              : isReserved
              ? "blue.50"
              : clinic.is_full
              ? "red.50"
              : "white"
          }
          _hover={{
            shadow: hasClinic && !clinic.is_full && !isPastDay ? "md" : "none",
            cursor: hasClinic && !clinic.is_full && !isPastDay ? "pointer" : "default",
          }}
          transition="all 0.2s"
          onClick={() => {
            if (hasClinic && !isPastDay) {
              if (isReserved) {
                // 예약 취소 확인 모달 표시
                setSelectedSlot({ day, time, clinic, action: 'cancel' });
                onOpen();
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
                    color="gray.600" 
                    fontWeight="bold"
                    lineHeight="1.2"
                  >
                    {time}
                  </Text>
                  <Text 
                    fontSize={{ base: "0.6rem", sm: "xs", md: "xs" }}
                    color="gray.600" 
                    fontWeight="bold"
                    lineHeight="1.2"
                  >
                    {/* md 이상에서는 축약형, 그 이하에서는 전체 */}
                    <Box display={{ base: "block", md: "none" }}>{dayNames[day]}</Box>
                    <Box display={{ base: "none", md: "block" }}>{dayNamesShort[day]}</Box>
                  </Text>
                </HStack>
                
                                 {/* 예약됨 뱃지 - 상단 우측에서 중앙 상단으로 이동 */}
                 {isReserved && (
                   <Center mb={0.5}>
                     <Badge 
                       colorScheme="blue" 
                       fontSize={{ base: "0.6rem", sm: "0.8rem", md: "0.8rem" }}
                       px={0.8}
                       py={0.2}
                     >
                       예약됨
                     </Badge>
                   </Center>
                 )}
                
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
                       color="gray.500"
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
                         clinic.is_full ? "red.500" : clinic.remaining_spots <= 3 ? "orange.500" : "blue.600"
                       }
                     >
                       {clinic.current_count}/{clinic.capacity}
                     </Text>
                   )}
                </Box>
                
                                 {/* 마감 표시 - 하단 중앙 */}
                 {clinic.is_full && !isPastDay && (
                   <Center>
                     <Text 
                       fontSize={{ base: "0.6rem", sm: "xs", md: "xs" }}
                       color="red.500" 
                       fontWeight="bold"
                     >
                       마감
                     </Text>
                   </Center>
                 )}
              </>
            ) : (
                             <Center height="100%">
                 <Text 
                   fontSize={{ base: "xs", sm: "xs", md: "xs" }}
                   color="gray.400"
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
    <Container maxW="container.xl" py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }}>
      <VStack spacing={4} align="stretch">
        <VStack spacing={2} textAlign="center">
          <Heading 
            as="h1" 
            size={{ base: "lg", md: "md" }}
            fontWeight="bold"
            color="gray.600"
          >
            보충 예약
          </Heading>
          <Text 
            fontSize={{ base: "md", md: "lg" }}
            color="blue.500"
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
        >
          {selectedSlot && (
            <>
              <ModalBody pt={6} px={{ base: 4, md: 6 }}>
                <Text 
                  textAlign="center" 
                  // 모바일에서 더 큰 텍스트
                  fontSize={{ base: "lg", md: "md" }}
                  mb={4}
                  lineHeight="1.5"
                >
                  {selectedSlot.action === 'reserve' 
                    ? `${dayNames[selectedSlot.day]} ${selectedSlot.time} ${selectedSlot.clinic.room} 예약 하시겠습니까?`
                    : `${dayNames[selectedSlot.day]} ${selectedSlot.time} ${selectedSlot.clinic.room} 예약을 취소하시겠습니까?`
                  }
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
                  colorScheme={selectedSlot.action === 'cancel' ? "red" : "blue"}
                  onClick={confirmReservation}
                  isLoading={reserving}
                  loadingText={selectedSlot.action === 'cancel' ? "취소 중..." : "예약 중..."}
                  size={{ base: "md", md: "sm" }}
                >
                  {selectedSlot.action === 'cancel' ? "예약 취소" : "예약 확정"}
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