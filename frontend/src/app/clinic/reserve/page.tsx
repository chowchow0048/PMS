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
  
  // 모달 및 유틸리티
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user, token, isLoading } = useAuth();
  const toast = useToast();

  // 요일 매핑
  const dayNames: { [key: string]: string } = {
    mon: '월요일',
    tue: '화요일',
    wed: '수요일',
    thu: '목요일',
    fri: '금요일',
    sat: '토요일',
  };

  // 초기 데이터 로드 (인증 완료 후)
  useEffect(() => {
    if (!isLoading && token) {
      loadWeeklySchedule();
    }
  }, [token, isLoading]);

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
      console.error('스케줄 로드 오류:', error);
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
      console.error('예약 오류:', error);
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
      console.error('취소 오류:', error);
      toast({
        title: '네트워크 오류',
        description: '취소 요청 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 슬롯 렌더링
  const renderSlot = (day: string, time: string) => {
    const clinic = schedule[day]?.[time];
    if (!clinic) return null;

    const isReserved = user && clinic.students.some(student => student.id === user.id);
    const hasClinic = clinic.clinic_id !== null;

    return (
      <GridItem key={`${day}-${time}`}>
        <Box
          p={1}
          width="95%"
          mx="0"
          aspectRatio={1}  // 정사방형 (width와 height 같게)
          border="1px solid"
          borderColor={hasClinic ? "gray.200" : "gray.100"}
          borderRadius="md"
          bg={
            !hasClinic
              ? "gray.50"
              : isReserved
              ? "blue.50"
              : clinic.is_full
              ? "red.50"
              : "white"
          }
          _hover={{
            shadow: hasClinic && !clinic.is_full ? "md" : "none",
            cursor: hasClinic && !clinic.is_full ? "pointer" : "default",
          }}
          transition="all 0.2s"
          onClick={() => {
            if (hasClinic) {
              if (isReserved) {
                // 예약 취소 확인 모달 표시
                setSelectedSlot({ day, time, clinic, action: 'cancel' });
                onOpen();
              } else if (!clinic.is_full) {
                handleReserveClinic(day, time, clinic);
              }
            }
          }}
        >
          <Box position="relative" height="100%">
            {hasClinic ? (
              <>
                {/* 시작 시간 - 최상단 좌측 */}
                <Text 
                  fontSize="xs" 
                  color="gray.600" 
                  position="absolute"
                  top={1}
                  left={1}
                  fontWeight="bold"
                >
                  {time} {dayNames[day]}
                </Text>

                {/* <Text 
                  fontSize="xs" 
                  color="gray.600" 
                  position="absolute"
                  top={1}
                  left="47.5%"
                  transform="translateX(-50%)"
                  fontWeight="bold"
                >
                  {dayNames[day]}    {clinic.room}
                </Text> */}
                
                {/* 예약됨 뱃지 - 최상단 우측 */}
                {isReserved && (
                  <Badge 
                    colorScheme="blue" 
                    position="absolute"
                    top={1}
                    right={1}
                    fontSize="xs"
                  >
                    예약됨
                  </Badge>
                )}
                
                {/* 정가운데 인원수 표시 */}
                <Box
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                >
                  <Text
                    fontSize="lg"
                    fontWeight="bold"
                    textAlign="center"
                    color={
                      clinic.is_full ? "red.500" : clinic.remaining_spots <= 3 ? "orange.500" : "green.600"
                    }
                  >
                    {clinic.current_count}/{clinic.capacity}
                  </Text>
                </Box>
                
                {/* 마감 표시 - 하단 중앙 */}
                {clinic.is_full && (
                  <Text 
                    fontSize="sm" 
                    color="red.500" 
                    fontWeight="bold"
                    position="absolute"
                    bottom={1}
                    left="50%"
                    transform="translateX(-50%)"
                  >
                    마감
                  </Text>
                )}
              </>
            ) : (
              <Text 
                fontSize="sm" 
                color="gray.400" 
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
              >
                                 클리닉 없음
               </Text>
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
    <Container maxW="container.xl" py={4}>
      <VStack spacing={1} align="stretch">
        <Heading as="h1" size="md" pb={2} textAlign="center" fontWeight="normal">
          {/* 보충 예약 */}
        </Heading>
      
        {/* 동적 n*m 그리드 (시간 x 요일) */}
        <Box 
          overflowX="auto"
          display="flex"
          justifyContent="center"
          alignItems="center"
        >
          <Grid
            // 요일별로 동일한 크기의 컬럼들만 사용
            templateColumns={`repeat(${days.length}, 1fr)`}
            columnGap="0rem"
            rowGap="0.5rem"
            // 컨테이너 크기를 비율 기반으로 설정 (더 컴팩트하게)
            w="100%"
            maxW="800px"
          >
            {/* 각 시간대별 행 */}
            {times.map(time => (
              <React.Fragment key={time}>
                {/* 해당 시간의 요일별 슬롯 */}
                {days.map(day => renderSlot(day, time))}
              </React.Fragment>
            ))}
          </Grid>
        </Box>


      </VStack>

      {/* 예약 확인 모달 */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay bg="blackAlpha.300" />
        <ModalContent>
          {selectedSlot && (
            <>
              <ModalBody pt={6}>
                <Text textAlign="center" fontSize="lg" mb={4}>
                  {selectedSlot.action === 'reserve' 
                    ? `${dayNames[selectedSlot.day]} ${selectedSlot.time} ${selectedSlot.clinic.room} 예약 하시겠습니까?`
                    : `${dayNames[selectedSlot.day]} ${selectedSlot.time} ${selectedSlot.clinic.room} 예약을 취소하시겠습니까?`
                  }
                </Text>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onClose}>
                  닫기
                </Button>
                <Button
                  colorScheme={selectedSlot.action === 'cancel' ? "red" : "blue"}
                  onClick={confirmReservation}
                  isLoading={reserving}
                  loadingText={selectedSlot.action === 'cancel' ? "취소 중..." : "예약 중..."}
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