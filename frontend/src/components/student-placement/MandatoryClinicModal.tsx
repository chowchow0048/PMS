'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Button,
  Grid,
  GridItem,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  Box,
  Badge,
  useToast,
  Spinner,
  Center,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { Student } from '@/lib/types';
import { getStudents, updateStudentNonPass, updateStudentEssentialClinic } from '@/lib/api';

interface MandatoryClinicModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MandatoryClinicModal: React.FC<MandatoryClinicModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null); // 업데이트 중인 학생 ID
  const [reservedStudentIds, setReservedStudentIds] = useState<Set<number>>(new Set()); // 예약한 학생 ID 집합
  const toast = useToast();

  // Dark mode colors
  const bgColor = useColorModeValue('white', 'dark.surface');
  const borderColor = useColorModeValue('gray.300', 'gray.600');
  const textColor = useColorModeValue('gray.700', 'gray.100');
  const secondaryTextColor = useColorModeValue('gray.600', 'gray.300');
  const tertiaryTextColor = useColorModeValue('gray.500', 'gray.400');
  const searchBg = useColorModeValue('white', 'gray.700');
  const searchIconColor = useColorModeValue('gray.300', 'gray.500');
  const statisticsBg = useColorModeValue('gray.50', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.600');
  const mandatoryBg = useColorModeValue('red.50', 'red.900');
  const mandatoryHoverBg = useColorModeValue('red.100', 'red.800');
  const mandatoryBorder = useColorModeValue('red.300', 'red.600');
  const mandatoryTextColor = useColorModeValue('red.700', 'red.200');
  const mandatorySecondaryTextColor = useColorModeValue('red.600', 'red.300');
  const yellowBg = useColorModeValue('yellow.50', 'yellow.900');
  const yellowHoverBg = useColorModeValue('yellow.100', 'yellow.800');
  const yellowBorder = useColorModeValue('yellow.300', 'yellow.600');
  const yellowTextColor = useColorModeValue('yellow.700', 'yellow.200');
  const yellowSecondaryTextColor = useColorModeValue('yellow.600', 'yellow.300');
  const greenBg = useColorModeValue('green.50', 'green.900');
  const greenHoverBg = useColorModeValue('green.100', 'green.800');
  const greenBorder = useColorModeValue('green.300', 'green.600');
  const greenTextColor = useColorModeValue('green.700', 'green.200');
  const greenSecondaryTextColor = useColorModeValue('green.600', 'green.300');

  // 학생 그룹 분류 함수 (실제 클리닉 예약 데이터 반영)
  const getStudentGroup = (student: Student): 'mandatory' | 'required' | 'reserved' => {
    // 1. non_pass=True (테두리 빨간색) - 의무 대상자
    if (student.non_pass) {
      return 'mandatory';
    }
    
    // 2. 실제 클리닉 예약 여부 확인
    const hasReservation = reservedStudentIds.has(student.id);
    
    if (hasReservation) {
      // 예약함 (테두리 초록색)
      return 'reserved';
    } else if (student.essential_clinic === true) {
      // essential_clinic=True && 클리닉 예약 안함 (테두리 노란색)
      return 'required';
    } else {
      // essential_clinic=False && 클리닉 예약 안함
      // 요구사항에 따라 'required' 그룹으로 분류 (필수 클리닉 신청 안함)
      return 'required';
    }
  };

  // 학생 그룹별 스타일 반환
  const getStudentGroupStyle = (group: 'mandatory' | 'required' | 'reserved') => {
    switch (group) {
      case 'mandatory':
        return {
          bg: useColorModeValue('white', 'dark.surface'),
          borderColor: mandatoryBorder,
          hoverBg: mandatoryHoverBg,
          textColor: mandatoryTextColor,
          secondaryTextColor: mandatorySecondaryTextColor,
          colorScheme: 'red' as const,
        };
      case 'required':
        return {
          bg: useColorModeValue('white', 'dark.surface'),
          borderColor: yellowBorder,
          hoverBg: yellowHoverBg,
          textColor: yellowTextColor,
          secondaryTextColor: yellowSecondaryTextColor,
          colorScheme: 'yellow' as const,
        };
      case 'reserved':
        return {
          bg: useColorModeValue('white', 'dark.surface'),
          borderColor: greenBorder,
          hoverBg: greenHoverBg,
          textColor: greenTextColor,
          secondaryTextColor: greenSecondaryTextColor,
          colorScheme: 'green' as const,
        };
    }
  };

  // 모달이 열릴 때 학생 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadStudents();
    }
  }, [isOpen]);

  // 검색어에 따른 학생 필터링
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.school?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.grade?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      // 필터링된 결과를 3그룹 순서대로 정렬
      const sortedFiltered = filtered.sort((a, b) => {
        const groupA = getStudentGroup(a);
        const groupB = getStudentGroup(b);
        
        // 그룹 우선순위: mandatory -> required -> reserved
        const groupOrder = { mandatory: 0, required: 1, reserved: 2 };
        
        if (groupA !== groupB) {
          return groupOrder[groupA] - groupOrder[groupB];
        }
        
        // 같은 그룹 내에서는 이름순으로 정렬
        return a.student_name.localeCompare(b.student_name, 'ko-KR');
      });
      setFilteredStudents(sortedFiltered);
    }
  }, [searchTerm, students]);

  // 클리닉 예약 데이터 로드
  const loadClinicReservations = async () => {
    try {
      console.log('🔍 [MandatoryClinicModal] 클리닉 예약 데이터 로드 시작');
      
      // 현재 주의 시작일과 종료일 계산
      const now = new Date();
      const currentDay = now.getDay(); // 0 = 일요일, 1 = 월요일, ...
      const monday = new Date(now);
      monday.setDate(now.getDate() - currentDay + 1); // 이번 주 월요일
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6); // 이번 주 일요일
      sunday.setHours(23, 59, 59, 999);
      
      const mondayStr = monday.toISOString().split('T')[0]; // YYYY-MM-DD 형식
      const sundayStr = sunday.toISOString().split('T')[0]; // YYYY-MM-DD 형식
      
      console.log(`🔍 [MandatoryClinicModal] 이번 주 범위: ${mondayStr} ~ ${sundayStr}`);
      
      // ClinicAttendance API를 통해 현재 주의 예약 데이터만 가져오기
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinic-attendances/?is_active=true&date_after=${mondayStr}&date_before=${sundayStr}`, {
        headers: {
          'Authorization': `Token ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const attendanceData = await response.json();
        console.log('✅ [MandatoryClinicModal] 예약 데이터:', attendanceData);
        
        // 예약한 학생 ID들을 Set으로 저장 (중복 제거 및 빠른 조회)
        const reservedIds = new Set<number>();
        
        if (Array.isArray(attendanceData)) {
          console.log('🔍 [MandatoryClinicModal] 배열 형태 데이터 처리');
          attendanceData.forEach((attendance: any, index) => {
            console.log(`🔍 [MandatoryClinicModal] 예약 ${index}:`, attendance);
            if (attendance.student) {
              reservedIds.add(attendance.student);
            }
          });
        } else if (attendanceData.results && Array.isArray(attendanceData.results)) {
          // 페이지네이션된 응답인 경우
          console.log('🔍 [MandatoryClinicModal] 페이지네이션 데이터 처리');
          attendanceData.results.forEach((attendance: any, index) => {
            console.log(`🔍 [MandatoryClinicModal] 예약 ${index}:`, attendance);
            if (attendance.student) {
              reservedIds.add(attendance.student);
            }
          });
        }
        
        setReservedStudentIds(reservedIds);
        console.log('✅ [MandatoryClinicModal] 예약한 학생 ID들:', Array.from(reservedIds));
        
      } else {
        console.error('❌ [MandatoryClinicModal] 예약 데이터 로드 실패:', response.status);
      }
      
    } catch (error) {
      console.error('❌ [MandatoryClinicModal] 예약 데이터 로드 오류:', error);
    }
  };

  // 학생 데이터 로드
  const loadStudents = async () => {
    try {
      setLoading(true);
      
      // 학생 데이터와 예약 데이터를 병렬로 로드
      await Promise.all([
        loadClinicReservations(),
        (async () => {
          const studentsData = await getStudents();
          
          // 3그룹 순서대로 정렬
          const sortedStudents = studentsData.sort((a, b) => {
            const groupA = getStudentGroup(a);
            const groupB = getStudentGroup(b);
            
            // 그룹 우선순위: mandatory -> required -> reserved
            const groupOrder = { mandatory: 0, required: 1, reserved: 2 };
            
            if (groupA !== groupB) {
              return groupOrder[groupA] - groupOrder[groupB];
            }
            
            // 같은 그룹 내에서는 이름순으로 정렬
            return a.student_name.localeCompare(b.student_name, 'ko-KR');
          });
          
          setStudents(sortedStudents);
          setFilteredStudents(sortedStudents);
          console.log('🔍 [MandatoryClinicModal] 학생 데이터 로드 완료:', sortedStudents.length);
          console.log('🔍 [MandatoryClinicModal] 의무 클리닉 대상자:', sortedStudents.filter(s => s.non_pass).length, '명');
        })()
      ]);
    } catch (error) {
      console.error('❌ [MandatoryClinicModal] 학생 데이터 로드 실패:', error);
      toast({
        title: '데이터 로드 실패',
        description: '학생 명단을 불러오는데 실패했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 학생의 필수 클리닉 신청 상태 토글
  const handleToggleEssentialClinic = async (student: Student) => {
    const newEssentialClinicStatus = !student.essential_clinic;
    const originalStudent = { ...student };
    
    console.log(`🔍 [MandatoryClinicModal] essential_clinic 상태 변경 시도: ${student.student_name} (ID: ${student.id}) - ${student.essential_clinic} → ${newEssentialClinicStatus}`);
    
    // 1. 즉시 UI 업데이트 (Optimistic Update)
    const optimisticStudents = students.map(s =>
      s.id === student.id ? { ...s, essential_clinic: newEssentialClinicStatus } : s
    );
    const sortedOptimisticStudents = optimisticStudents.sort((a, b) => {
      const groupA = getStudentGroup(a);
      const groupB = getStudentGroup(b);
      
      // 그룹 우선순위: mandatory -> required -> reserved
      const groupOrder = { mandatory: 0, required: 1, reserved: 2 };
      
      if (groupA !== groupB) {
        return groupOrder[groupA] - groupOrder[groupB];
      }
      
      // 같은 그룹 내에서는 이름순으로 정렬
      return a.student_name.localeCompare(b.student_name, 'ko-KR');
    });
    setStudents(sortedOptimisticStudents);
    
    // 2. 짧은 로딩 상태 설정 (시각적 피드백용)
    setUpdating(student.id);
    
    try {
      // 3. API 호출
      const response = await updateStudentEssentialClinic(student.id, newEssentialClinicStatus);
      console.log('✅ [MandatoryClinicModal] API 응답:', response);
      
      // 4. API 응답으로 최종 확인
      const actualEssentialClinicStatus = response.essential_clinic ?? newEssentialClinicStatus;
      
      // 5. API 응답과 로컬 상태가 다른 경우에만 재업데이트
      if (actualEssentialClinicStatus !== newEssentialClinicStatus) {
        const correctedStudents = students.map(s =>
          s.id === student.id ? { ...s, essential_clinic: actualEssentialClinicStatus } : s
        );
        const sortedCorrectedStudents = correctedStudents.sort((a, b) => {
          const groupA = getStudentGroup(a);
          const groupB = getStudentGroup(b);
          
          const groupOrder = { mandatory: 0, required: 1, reserved: 2 };
          
          if (groupA !== groupB) {
            return groupOrder[groupA] - groupOrder[groupB];
          }
          
          return a.student_name.localeCompare(b.student_name, 'ko-KR');
        });
        setStudents(sortedCorrectedStudents);
      }
      
      console.log(`✅ [MandatoryClinicModal] 로컬 상태 업데이트 완료: ${actualEssentialClinicStatus}`);
      
      // 성공 토스트
      toast({
        title: '완료',
        description: `${student.student_name} ${actualEssentialClinicStatus ? '필수 신청' : '신청 취소'}`,
        status: 'success',
        duration: 1000,
        isClosable: true,
      });
      
    } catch (error) {
      console.error('❌ [MandatoryClinicModal] essential_clinic 상태 업데이트 실패:', error);
      
      // 6. 실패 시 원래 상태로 롤백
      const rolledBackStudents = students.map(s =>
        s.id === student.id ? originalStudent : s
      );
      const sortedRolledBackStudents = rolledBackStudents.sort((a, b) => {
        const groupA = getStudentGroup(a);
        const groupB = getStudentGroup(b);
        
        const groupOrder = { mandatory: 0, required: 1, reserved: 2 };
        
        if (groupA !== groupB) {
          return groupOrder[groupA] - groupOrder[groupB];
        }
        
        return a.student_name.localeCompare(b.student_name, 'ko-KR');
      });
      setStudents(sortedRolledBackStudents);
      
      // 상세한 오류 정보 표시
      let errorMessage = '필수 클리닉 신청 상태 변경에 실패했습니다.';
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error;
        } else if (axiosError.response?.status === 404) {
          errorMessage = '학생 정보를 찾을 수 없습니다.';
        } else if (axiosError.response?.status === 403) {
          errorMessage = '권한이 없습니다.';
        }
      }
      
      toast({
        title: '변경 실패',
        description: `${student.student_name} - ${errorMessage}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      // 7. 로딩 상태를 짧은 지연 후 해제
      setTimeout(() => {
        setUpdating(null);
      }, 200);
    }
  };

  // 학생의 의무 클리닉 상태 토글 (최적화된 버전)
  const handleToggleNonPass = async (student: Student) => {
    const newNonPassStatus = !student.non_pass;
    const originalStudent = { ...student };
    
    console.log(`🔍 [MandatoryClinicModal] 상태 변경 시도: ${student.student_name} (ID: ${student.id}) - ${student.non_pass} → ${newNonPassStatus}`);
    
    // 1. 즉시 UI 업데이트 (Optimistic Update)
    const optimisticStudents = students.map(s =>
      s.id === student.id ? { ...s, non_pass: newNonPassStatus } : s
    );
    const sortedOptimisticStudents = optimisticStudents.sort((a, b) => {
      const groupA = getStudentGroup(a);
      const groupB = getStudentGroup(b);
      
      // 그룹 우선순위: mandatory -> required -> reserved
      const groupOrder = { mandatory: 0, required: 1, reserved: 2 };
      
      if (groupA !== groupB) {
        return groupOrder[groupA] - groupOrder[groupB];
      }
      
      // 같은 그룹 내에서는 이름순으로 정렬
      return a.student_name.localeCompare(b.student_name, 'ko-KR');
    });
    setStudents(sortedOptimisticStudents);
    
    // 2. 짧은 로딩 상태 설정 (시각적 피드백용)
    setUpdating(student.id);
    
    try {
      // 3. API 호출
      const response = await updateStudentNonPass(student.id, newNonPassStatus);
      console.log('✅ [MandatoryClinicModal] API 응답:', response);
      
      // 4. API 응답으로 최종 확인 (보통은 이미 올바른 상태)
      const actualNonPassStatus = response.non_pass ?? newNonPassStatus;
      
      // 5. API 응답과 로컬 상태가 다른 경우에만 재업데이트
      if (actualNonPassStatus !== newNonPassStatus) {
        const correctedStudents = students.map(s =>
          s.id === student.id ? { ...s, non_pass: actualNonPassStatus } : s
        );
        const sortedCorrectedStudents = correctedStudents.sort((a, b) => {
          const groupA = getStudentGroup(a);
          const groupB = getStudentGroup(b);
          
          const groupOrder = { mandatory: 0, required: 1, reserved: 2 };
          
          if (groupA !== groupB) {
            return groupOrder[groupA] - groupOrder[groupB];
          }
          
          return a.student_name.localeCompare(b.student_name, 'ko-KR');
        });
        setStudents(sortedCorrectedStudents);
      }
      
      console.log(`✅ [MandatoryClinicModal] 로컬 상태 업데이트 완료: ${actualNonPassStatus}`);
      
      // 성공 토스트는 더 짧게
      toast({
        title: '완료',
        description: `${student.student_name} ${actualNonPassStatus ? '의무 설정' : '의무 해제'}`,
        status: 'success',
        duration: 1000,
        isClosable: true,
      });
      
    } catch (error) {
      console.error('❌ [MandatoryClinicModal] 상태 업데이트 실패:', error);
      
      // 6. 실패 시 원래 상태로 롤백
      const rolledBackStudents = students.map(s =>
        s.id === student.id ? originalStudent : s
      );
      const sortedRolledBackStudents = rolledBackStudents.sort((a, b) => {
        const groupA = getStudentGroup(a);
        const groupB = getStudentGroup(b);
        
        const groupOrder = { mandatory: 0, required: 1, reserved: 2 };
        
        if (groupA !== groupB) {
          return groupOrder[groupA] - groupOrder[groupB];
        }
        
        return a.student_name.localeCompare(b.student_name, 'ko-KR');
      });
      setStudents(sortedRolledBackStudents);
      
      // 상세한 오류 정보 표시
      let errorMessage = '의무 클리닉 상태 변경에 실패했습니다.';
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error;
        } else if (axiosError.response?.status === 404) {
          errorMessage = '학생 정보를 찾을 수 없습니다.';
        } else if (axiosError.response?.status === 403) {
          errorMessage = '권한이 없습니다.';
        }
      }
      
      toast({
        title: '변경 실패',
        description: `${student.student_name} - ${errorMessage}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      // 7. 로딩 상태를 짧은 지연 후 해제 (부드러운 전환)
      setTimeout(() => {
        setUpdating(null);
      }, 200);
    }
  };

  // 모달 닫기 시 검색어 초기화
  const handleClose = () => {
    setSearchTerm('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="6xl" isCentered>
      <ModalOverlay bg="useColorModeValue('gray.50', 'dark.background')" />
      <ModalContent 
        border={"1px"}
        borderColor={useColorModeValue('gray.200', 'dark.border')}
        maxH="90vh" 
        minH="80vh"
        minW="80vw"
        display="flex" 
        flexDirection="column"
        bg={useColorModeValue('white', 'dark.background')}
      >
        <ModalHeader bg={useColorModeValue('gray.50', 'dark.background')}>
          <Text fontSize="xl" fontWeight="bold" color={textColor}>
            의무 클리닉 관리
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody flex="1" overflow="hidden" display="flex" flexDirection="column">
          {/* 검색 입력창 */}
          <Box mb={4}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color={searchIconColor} />
              </InputLeftElement>
              <Input
                placeholder="학생 이름, 아이디, 학교, 학년으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg={searchBg}
                borderColor={borderColor}
                color={textColor}
                _focus={{
                  borderColor: "blue.500",
                  boxShadow: "0 0 0 1px #3182ce",
                }}
                _placeholder={{
                  color: tertiaryTextColor,
                }}
              />
            </InputGroup>
          </Box>

          {/* 학생 목록 */}
          <Box flex="1" overflow="auto">
            {loading ? (
              <Center py={8}>
                <VStack spacing={4}>
                  <Spinner size="lg" color="blue.500" />
                  <Text color={secondaryTextColor}>학생 명단을 불러오는 중...</Text>
                </VStack>
              </Center>
            ) : filteredStudents.length === 0 ? (
              <Center py={8}>
                <Text color={tertiaryTextColor} fontSize="lg">
                  {searchTerm ? '검색 결과가 없습니다.' : '학생이 없습니다.'}
                </Text>
              </Center>
            ) : (
              <Grid
                templateColumns="repeat(4, 1fr)"
                gap={3}
                p={2}
              >
                {filteredStudents.map((student) => (
                  <GridItem key={student.id}>
                    {(() => {
                      const group = getStudentGroup(student);
                      const style = getStudentGroupStyle(group);
                      
                      return (
                        <Button
                          w="100%"
                          h="auto"
                          p={4}
                          variant="outline"
                          colorScheme={style.colorScheme}
                          bg={style.bg}
                          borderColor={style.borderColor}
                          _hover={{
                            bg: style.hoverBg,
                          }}
                          transition="all 0.15s ease-in-out"
                          onClick={() => {
                            // 좌클릭: non_pass 토글
                            // Shift + 클릭: essential_clinic 토글 (non_pass가 false일 때만)
                            if (window.event && (window.event as MouseEvent).shiftKey && !student.non_pass) {
                              handleToggleEssentialClinic(student);
                            } else {
                              handleToggleNonPass(student);
                            }
                          }}
                          onContextMenu={(e) => {
                            // 우클릭: essential_clinic 토글 (non_pass가 false일 때만)
                            e.preventDefault();
                            if (!student.non_pass) {
                              handleToggleEssentialClinic(student);
                            }
                          }}
                          isLoading={updating === student.id}
                          loadingText=""
                          opacity={updating === student.id ? 0.7 : 1}
                          isDisabled={updating !== null && updating !== student.id}
                        >
                          <VStack spacing={2} align="stretch" w="100%" h="100px" justify="space-between">
                            <Box textAlign="left">
                              <Box display="flex" alignItems="center" gap={2} mb={1}>
                                <Text
                                  fontSize="md"
                                  fontWeight="bold"
                                  color={style.textColor}
                                  noOfLines={1}
                                  flex="1"
                                >
                                  {student.student_name}
                                </Text>
                                {group === 'mandatory' && (
                                  <Badge
                                    colorScheme="red"
                                    variant="solid"
                                    fontSize="xs"
                                    px={2}
                                    py={1}
                                    flexShrink={0}
                                  >
                                    의무
                                  </Badge>
                                )}
                                {group === 'required' && (
                                  <Badge
                                    colorScheme="yellow"
                                    variant="solid"
                                    fontSize="xs"
                                    px={2}
                                    py={1}
                                    flexShrink={0}
                                  >
                                    {student.essential_clinic ? '필수' : '미신청'}
                                  </Badge>
                                )}
                                {group === 'reserved' && (
                                  <Badge
                                    colorScheme="green"
                                    variant="solid"
                                    fontSize="xs"
                                    px={2}
                                    py={1}
                                    flexShrink={0}
                                  >
                                    예약
                                  </Badge>
                                )}
                              </Box>
                              <Text
                                fontSize="sm"
                                color={style.secondaryTextColor}
                                noOfLines={1}
                              >
                                {student.username}
                              </Text>
                            </Box>
                            
                            <Box textAlign="left">
                              <Text
                                fontSize="xs"
                                color={style.secondaryTextColor}
                              >
                                {student.school} {student.grade}
                              </Text>
                            </Box>
                          </VStack>
                        </Button>
                      );
                    })()}
                  </GridItem>
                ))}
              </Grid>
            )}
          </Box>

          {/* 통계 정보 */}
          <Box mt={4} p={3} bg={useColorModeValue('gray.50', 'dark.background')} borderRadius="md">
            <VStack spacing={2}>
              <Text fontSize="sm" color={secondaryTextColor} textAlign="center">
                총 {students.length}명 중{' '}
                <Text as="span" fontWeight="bold" color="red.500">
                  의무 {students.filter(s => getStudentGroup(s) === 'mandatory').length}명
                </Text>
                {' / '}
                <Text as="span" fontWeight="bold" color="yellow.500">
                  필수 {students.filter(s => getStudentGroup(s) === 'required').length}명
                </Text>
                {' / '}
                <Text as="span" fontWeight="bold" color="green.500">
                  예약 {students.filter(s => getStudentGroup(s) === 'reserved').length}명
                </Text>
                {searchTerm && (
                  <>
                    {' '}(검색 결과: {filteredStudents.length}명)
                  </>
                )}
              </Text>
            </VStack>
          </Box>
        </ModalBody>


      </ModalContent>
    </Modal>
  );
};

export default MandatoryClinicModal;
