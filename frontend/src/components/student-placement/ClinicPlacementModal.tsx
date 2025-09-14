'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  SimpleGrid,
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  useToast,
  Spinner,
  Center,
  useColorModeValue,
} from '@chakra-ui/react';
import { Student } from '@/lib/types';
import { log } from 'console';

// 요일 매핑
const DAY_MAPPING = {
  mon: '월요일',
  tue: '화요일', 
  wed: '수요일',
  thu: '목요일',
  fri: '금요일',
  sat: '토요일',
  sun: '일요일',
};

// 시간대 매핑
const TIME_MAPPING = {
  '18:00': '18:00-19:00',
  '19:00': '19:00-20:00', 
  '20:00': '20:00-21:00',
  '21:00': '21:00-22:00',
};

// 클리닉 슬롯 인터페이스
interface ClinicSlot {
  clinic_id: number | null;
  teacher_name: string | null;
  subject: string | null;
  room: string | null;
  capacity: number;
  current_count: number;
  remaining_spots: number;
  is_full: boolean;
  students: any[];
}

// 주간 스케줄 타입
interface WeeklySchedule {
  [day: string]: {
    [time: string]: ClinicSlot;
  };
}

// 스케줄 응답 타입
interface ScheduleResponse {
  schedule: WeeklySchedule;
  days: string[];
  times: string[];
  total_clinics: number;
}

// 모달 props
interface ClinicPlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudent: Student | null;
  onPlaceStudent: (clinicId: number, studentId: number) => Promise<void>;
  onUnassignStudent?: (studentId: number) => Promise<void>; // 배치 해제 함수 추가
  onClinicDataUpdate?: (clinicId: number, studentId: number, isAdd: boolean) => void; // 클리닉 데이터 업데이트 함수
  onUpdateStudentNonPass?: (studentId: number, nonPass: boolean) => void; // 학생 non_pass 상태 업데이트 함수
}

const ClinicPlacementModal: React.FC<ClinicPlacementModalProps> = ({
  isOpen,
  onClose,
  selectedStudent,
  onPlaceStudent,
  onUnassignStudent,
  onClinicDataUpdate,
  onUpdateStudentNonPass,
}) => {
  // 상태 관리
  const [schedule, setSchedule] = useState<WeeklySchedule>({});
  const [days, setDays] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<{
    clinicId: number;
    day: string;
    time: string;
  } | null>(null);
  
  // 선택된 학생의 non_pass 상태 (로컬 업데이트용)
  const [localStudentNonPass, setLocalStudentNonPass] = useState<boolean>(false);

  // 확인 다이얼로그 제거됨

  const toast = useToast();
  
  // 다크모드 색상 설정
  const modalBg = useColorModeValue('white', 'dark.background');
  const modalHeaderBg = useColorModeValue('gray.50', 'dark.background');
  const textColor = useColorModeValue('gray.800', 'dark.text');
  const secondaryTextColor = useColorModeValue('gray.600', 'dark.textSecondary');
  const borderColor = useColorModeValue('gray.200', 'dark.border');
  const cardBg = useColorModeValue('white', 'dark.surface');
  const hoverBg = useColorModeValue('gray.50', 'dark.hover');
  const dayHeaderBg = useColorModeValue('white', 'dark.surface2');
  const dayHeaderTextColor = useColorModeValue('black', 'dark.text');
  const clinicSlotBg = useColorModeValue('gray.50', 'dark.surface');
  const availableClinicBg = useColorModeValue('green.50', 'dark.surface');
  const fullClinicBg = useColorModeValue('red.50', 'dark.surface');
  const assignedClinicBg = useColorModeValue('green.50', 'dark.surface');
  const hoverAvailableBg = useColorModeValue('blue.50', 'dark.surface');

  // 주간 스케줄 로드
  const loadWeeklySchedule = async () => {
    try {
      setLoading(true);
      
      // 로컬스토리지에서 토큰 가져오기
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinics/weekly_schedule/`,
        {
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

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
        duration: 200,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 모달이 열릴 때 스케줄 로드
  useEffect(() => {
    if (isOpen) {
      loadWeeklySchedule();
    }
  }, [isOpen]);

  // selectedStudent가 변경될 때마다 로컬 non_pass 상태 초기화
  useEffect(() => {
    if (selectedStudent) {
      setLocalStudentNonPass(selectedStudent.non_pass || false);
    }
  }, [selectedStudent]);

  // 로컬 스케줄 상태 업데이트 함수 (학생 배치)
  const updateLocalScheduleForPlacement = (day: string, time: string, student: Student) => {
    console.log('🔍 [ClinicPlacementModal] 로컬 스케줄 업데이트 - 학생 배치:', { day, time, student: student.student_name });
    
    setSchedule(prevSchedule => {
      const newSchedule = { ...prevSchedule };
      if (newSchedule[day] && newSchedule[day][time]) {
        const clinic = { ...newSchedule[day][time] };
        
        // 학생을 students 배열에 추가
        const newStudent = {
          id: student.id,
          name: student.student_name,
          username: student.username || student.student_name,
        };
        
        clinic.students = [...clinic.students, newStudent];
        clinic.current_count = clinic.students.length;
        clinic.remaining_spots = clinic.capacity - clinic.current_count;
        clinic.is_full = clinic.current_count >= clinic.capacity;
        
        newSchedule[day][time] = clinic;
        console.log('✅ [ClinicPlacementModal] 로컬 스케줄 업데이트 완료 - 배치');
      }
      return newSchedule;
    });
  };

  // 로컬 스케줄 상태 업데이트 함수 (학생 배치 해제)
  const updateLocalScheduleForUnassignment = (day: string, time: string, student: Student) => {
    console.log('🔍 [ClinicPlacementModal] 로컬 스케줄 업데이트 - 학생 배치 해제:', { day, time, student: student.student_name });
    
    setSchedule(prevSchedule => {
      const newSchedule = { ...prevSchedule };
      if (newSchedule[day] && newSchedule[day][time]) {
        const clinic = { ...newSchedule[day][time] };
        
        // 학생을 students 배열에서 제거
        clinic.students = clinic.students.filter((s: any) => s.id !== student.id);
        clinic.current_count = clinic.students.length;
        clinic.remaining_spots = clinic.capacity - clinic.current_count;
        clinic.is_full = clinic.current_count >= clinic.capacity;
        
        newSchedule[day][time] = clinic;
        console.log('✅ [ClinicPlacementModal] 로컬 스케줄 업데이트 완료 - 배치 해제');
      }
      return newSchedule;
    });
  };

  // 요일이 과거인지 확인하는 함수
  const isDayInPast = (day: string): boolean => {
    const dayOrder: { [key: string]: number } = {
      'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 0
    };

    const today = new Date();
    console.log('🔍 [ClinicPlacementModal] 오늘 날짜:', today);
    const currentDay = today.getDay(); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
    console.log('🔍 [ClinicPlacementModal] 현재 요일:', currentDay);
    const targetDay = dayOrder[day];
    console.log('🔍 [ClinicPlacementModal] 목표 요일:', targetDay);

    // 오늘보다 이전 요일인지 확인 (일요일의 경우 특별 처리)
    if (currentDay === 0) { // 일요일인 경우
      return true; // 일요일에는 모든 요일 불가능
    } else {
      return targetDay < currentDay;
    }
  };

  // 클리닉 슬롯 클릭 핸들러
  const handleClinicSlotClick = (day: string, time: string, clinic: ClinicSlot) => {
    // 클리닉이 존재하지 않으면 배치 불가
    if (!clinic.clinic_id) {
      toast({
        title: '배치 불가',
        description: '해당 시간대에 클리닉이 존재하지 않습니다.',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    // 과거 요일인지 확인
    if (isDayInPast(day)) {
      toast({
        title: '배치 불가',
        description: '이미 지난 요일의 클리닉에는 배치하거나 해제할 수 없습니다.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // 정원이 가득 찬 경우
    if (clinic.is_full) {
      toast({
        title: '배치 불가',
        description: '해당 클리닉의 정원이 가득 찼습니다.',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    // 이미 배치된 학생인지 확인
    const isAlreadyAssigned = clinic.students.some(
      (student: any) => student.id === selectedStudent?.id
    );

    if (isAlreadyAssigned) {
      // 이미 배치된 경우 즉시 배치 해제
      handleDirectUnassign(day, time, clinic);
      return;
    }

    // 즉시 배치 실행
    handleDirectPlacement(day, time, clinic);
  };

  // 직접 배치 해제 (확인 다이얼로그 없이)
  const handleDirectUnassign = async (day: string, time: string, clinic: ClinicSlot) => {
    if (!selectedStudent || !onUnassignStudent) return;

    console.log('🔍 [ClinicPlacementModal] 직접 배치 해제 시작');
    console.log('🔍 [ClinicPlacementModal] selectedStudent:', selectedStudent);

    try {
      // 먼저 로컬 상태 업데이트 (낙관적 업데이트)
      updateLocalScheduleForUnassignment(day, time, selectedStudent);
      
      // 상위 컴포넌트의 클리닉 데이터도 업데이트 (ClinicDayBox 업데이트용)
      if (onClinicDataUpdate && clinic.clinic_id) {
        onClinicDataUpdate(clinic.clinic_id, selectedStudent.id, false); // false = 제거
      }
      
      // 백그라운드에서 API 호출
      await onUnassignStudent(selectedStudent.id);
      
      toast({
        title: '배치 해제 완료',
        description: `${selectedStudent.student_name} 학생의 클리닉 배치가 해제되었습니다.`,
        status: 'success',
        duration: 500,
        isClosable: true,
      });

      console.log('✅ [ClinicPlacementModal] 직접 배치 해제 완료');
      
    } catch (error) {
      console.error('❌ [ClinicPlacementModal] 배치 해제 오류:', error);
      
      // 실패 시 롤백 (로컬 상태)
      updateLocalScheduleForPlacement(day, time, selectedStudent);
      
      // 실패 시 상위 컴포넌트 롤백 (ClinicDayBox 롤백)
      if (onClinicDataUpdate && clinic.clinic_id) {
        onClinicDataUpdate(clinic.clinic_id, selectedStudent.id, true); // 다시 추가
      }
      
      toast({
        title: '배치 해제 실패',
        description: '학생 배치 해제 중 오류가 발생했습니다.',
        status: 'error',
        duration: 500,
        isClosable: true,
      });
    }
  };

  // 직접 배치 (확인 다이얼로그 없이)
  const handleDirectPlacement = async (day: string, time: string, clinic: ClinicSlot) => {
    if (!selectedStudent || !clinic.clinic_id) return;

    console.log('🔍 [ClinicPlacementModal] 직접 배치 시작');
    console.log('🔍 [ClinicPlacementModal] selectedStudent:', selectedStudent);

    try {
      // 먼저 로컬 상태 업데이트 (낙관적 업데이트)
      updateLocalScheduleForPlacement(day, time, selectedStudent);
      
      // 상위 컴포넌트의 클리닉 데이터도 업데이트 (ClinicDayBox 업데이트용)
      if (onClinicDataUpdate && clinic.clinic_id) {
        onClinicDataUpdate(clinic.clinic_id, selectedStudent.id, true); // true = 추가
      }
      
      // 의무 클리닉 대상자인 경우 non_pass 상태를 false로 업데이트 (뱃지 제거)
      if (selectedStudent.non_pass && onUpdateStudentNonPass) {
        setLocalStudentNonPass(false); // 로컬 상태 먼저 업데이트
        onUpdateStudentNonPass(selectedStudent.id, false); // 상위 컴포넌트 상태 업데이트
        console.log('✅ [ClinicPlacementModal] 의무 클리닉 대상자 뱃지 제거:', selectedStudent.student_name);
      }
      
      // 백그라운드에서 API 호출
      await onPlaceStudent(clinic.clinic_id, selectedStudent.id);
      
      toast({
        title: '배치 완료',
        description: `${selectedStudent.student_name} 학생이 ${DAY_MAPPING[day as keyof typeof DAY_MAPPING]} ${TIME_MAPPING[time as keyof typeof TIME_MAPPING]} 클리닉에 배치되었습니다.`,
        status: 'success',
        duration: 500,
        isClosable: true,
      });

      console.log('✅ [ClinicPlacementModal] 직접 배치 완료');
      
    } catch (error) {
      console.error('❌ [ClinicPlacementModal] 배치 오류:', error);
      
      // 실패 시 롤백 (로컬 상태)
      updateLocalScheduleForUnassignment(day, time, selectedStudent);
      
      // 실패 시 상위 컴포넌트 롤백 (ClinicDayBox 롤백)
      if (onClinicDataUpdate && clinic.clinic_id) {
        onClinicDataUpdate(clinic.clinic_id, selectedStudent.id, false); // 다시 제거
      }
      
      // 실패 시 의무 클리닉 상태 롤백 (뱃지 다시 표시)
      if (selectedStudent.non_pass && onUpdateStudentNonPass) {
        setLocalStudentNonPass(true); // 로컬 상태 롤백
        onUpdateStudentNonPass(selectedStudent.id, true); // 상위 컴포넌트 상태 롤백
        console.log('🔄 [ClinicPlacementModal] 의무 클리닉 대상자 뱃지 롤백:', selectedStudent.student_name);
      }
      
      toast({
        title: '배치 실패',
        description: '학생 배치 중 오류가 발생했습니다.',
        status: 'error',
        duration: 200,
        isClosable: true,
      });
    }
  };

  // 모달 닫기 시 상태 초기화
  const handleClose = () => {
    setSelectedClinic(null);
    onClose();
  };

  return (
    <>
      {/* 메인 모달 */}
      <Modal isOpen={isOpen} onClose={handleClose} size="6xl">
        <ModalOverlay />
        <ModalContent 
          maxH="90vh" 
          bg={modalBg} 
          color={textColor}
          border="1px"
          borderColor={borderColor}
        >
          <ModalHeader bg={modalHeaderBg} borderBottomWidth="1px" borderColor={borderColor}>
            <VStack spacing={2} align="start" flex={1}>
              <Text fontSize="xl" fontWeight="bold">
                클리닉 배치
              </Text>
              {selectedStudent && (
                <HStack spacing={2}>
                  <Badge colorScheme="blue" fontSize="sm" px={3} py={1}>
                    {selectedStudent.student_name}
                  </Badge>
                  <Badge colorScheme="green" fontSize="sm" px={3} py={1}>
                    {selectedStudent.school} {selectedStudent.grade}
                  </Badge>
                  {localStudentNonPass && (
                    <Badge colorScheme="orange" fontSize="sm" px={3} py={1}>
                      의무 클리닉 대상자
                    </Badge>
                  )}
                </HStack>
              )}
            </VStack>
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody
          mb={5}>
            {loading ? (
              <Center py={10}>
                <VStack spacing={4}>
                  <Spinner size="xl" color="blue.500" />
                  <Text color={textColor}>스케줄을 불러오는 중...</Text>
                </VStack>
              </Center>
            ) : (
              <VStack spacing={4} align="stretch">
                {/* <Text fontSize="md" color="gray.600" textAlign="center">
                  배치할 시간대를 선택해주세요
                </Text> */}
                
                {/* 스케줄 그리드 - 동적 컬럼 수 */}
                <Box overflowX="auto">
                  <SimpleGrid 
                    columns={days.length || 7} // 기본값을 7로 변경 (월~일)
                    spacing={4} 
                    minW={`${(days.length || 7) * 180}px`} // 너비도 조정
                  >
                    {days.map((day) => (
                      <VStack key={day} spacing={3} align="stretch">
                        {/* 요일 헤더 */}
                        <Box
                          bg={dayHeaderBg}
                          color={dayHeaderTextColor}
                          py={2}
                          px={4}
                          borderRadius="md"
                          textAlign="center"
                          fontWeight="bold"
                          border="1px"
                          borderColor={borderColor}
                        >
                          {DAY_MAPPING[day as keyof typeof DAY_MAPPING]}
                        </Box>
                        
                        {/* 시간대별 클리닉 슬롯 */}
                        <VStack spacing={2} align="stretch">
                          {times.map((time) => {
                            const clinic = schedule[day]?.[time];
                            const hasClinic = clinic?.clinic_id !== null;
                            const isFull = clinic?.is_full || false;
                            const isAlreadyAssigned = clinic?.students.some(
                              (student: any) => student.id === selectedStudent?.id
                            ) || false;
                            
                            return (
                              <Box
                                key={time}
                                p={3}
                                border="2px solid"
                                borderColor={
                                  !hasClinic ? borderColor :
                                  isAlreadyAssigned ? 'green.400' :
                                  isFull ? 'red.300' : 
                                  borderColor
                                }
                                bg={
                                  !hasClinic ? clinicSlotBg :
                                  isAlreadyAssigned ? assignedClinicBg :
                                  isFull ? fullClinicBg : 
                                  availableClinicBg
                                }
                                borderRadius="md"
                                cursor='pointer'
                                _hover={
                                  hasClinic && !isFull && !isAlreadyAssigned
                                    ? { 
                                        borderColor: 'blue.400', 
                                        bg: hoverAvailableBg,
                                      }
                                    : { bg: hoverBg }
                                }
                                transition="all 0.2s"
                                onClick={() => hasClinic && clinic && handleClinicSlotClick(day, time, clinic)}
                              >
                                <VStack spacing={4}>
                                  <Text fontWeight="bold" fontSize="sm" color={textColor}>
                                    {TIME_MAPPING[time as keyof typeof TIME_MAPPING]}
                                  </Text>
                                  
                                  {hasClinic && clinic ? (
                                    <>
                                      {/* <Text fontSize="xs" color={secondaryTextColor} noOfLines={1}>
                                        {clinic.teacher_name || '강사 미정'}
                                      </Text> */}
                                      <Text fontSize="xs" color={secondaryTextColor} noOfLines={1}>
                                        {clinic.room || '강의실 미정'}
                                      </Text>
                                      <Badge
                                        colorScheme={
                                          isAlreadyAssigned ? 'green' :
                                          isFull ? 'red' : 'blue'
                                        }
                                        fontSize="s"
                                      >
                                        {isAlreadyAssigned ? '배치됨' :
                                         isFull ? '정원 마감' :
                                         `${clinic.current_count}/${clinic.capacity}명`}
                                      </Badge>
                                    </>
                                  ) : (
                                    <Text fontSize="xs" color={secondaryTextColor}>
                                      클리닉 없음
                                    </Text>
                                  )}
                                </VStack>
                              </Box>
                            );
                          })}
                        </VStack>
                      </VStack>
                    ))}
                  </SimpleGrid>
                </Box>
                
                {/* 안내 메시지
                <Box
                  bg="blue.50"
                  border="1px solid"
                  borderColor="blue.200"
                  borderRadius="md"
                  p={4}
                  mt={4}
                >
                  <VStack spacing={2} align="start">
                    <Text fontSize="sm" fontWeight="bold" color="blue.700">
                      📋 배치 안내
                    </Text>
                    <VStack spacing={1} align="start" fontSize="xs" color="blue.600">
                      <HStack>
                        <Box w={3} h={3} bg="green.300" borderRadius="sm" />
                        <Text>배치 가능한 클리닉</Text>
                      </HStack>
                      <HStack>
                        <Box w={3} h={3} bg="red.300" borderRadius="sm" />
                        <Text>정원이 가득 찬 클리닉</Text>
                      </HStack>
                      <HStack>
                        <Box w={3} h={3} bg="yellow.300" borderRadius="sm" />
                        <Text>이미 배치된 클리닉</Text>
                      </HStack>
                      <HStack>
                        <Box w={3} h={3} bg="gray.300" borderRadius="sm" />
                        <Text>클리닉이 없는 시간대</Text>
                      </HStack>
                    </VStack>
                  </VStack>
                </Box> */}
              </VStack>
            )}
          </ModalBody>

          {/* <ModalFooter>
          </ModalFooter> */}
        </ModalContent>
      </Modal>

      {/* 확인 다이얼로그 제거됨 - 즉시 배치/해제 */}
    </>
  );
};

export default ClinicPlacementModal;
