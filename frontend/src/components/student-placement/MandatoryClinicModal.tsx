'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
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
  HStack,
  ButtonGroup,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { Student } from '@/lib/types';
import { getStudents, updateStudentNonPass, updateStudentEssentialClinic } from '@/lib/api';
import { log } from 'console';

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
  const [activeFilter, setActiveFilter] = useState<'mandatory' | 'required' | 'unrequired' | 'reserved' | null>(null); // 활성화된 필터
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null); // 예약 정보를 보여줄 학생
  const [studentReservations, setStudentReservations] = useState<Array<{day: string, time: string, dayDisplay: string, clinicId: number, attendanceId: number, expectedDate: string}>>([]);
  const [cancelingClinic, setCancelingClinic] = useState<{day: string, time: string, clinicId: number, attendanceId: number} | null>(null);
  const { isOpen: isCancelModalOpen, onOpen: onCancelModalOpen, onClose: onCancelModalClose } = useDisclosure();
  const { isOpen: isReservationInfoOpen, onOpen: onReservationInfoOpen, onClose: onReservationInfoClose } = useDisclosure();
  const toast = useToast();

  // Dark mode colors
  const bgColor = useColorModeValue('white', 'dark.surface');
  const borderColor = useColorModeValue('gray.300', 'dark.border');
  const textColor = useColorModeValue('gray.700', 'dark.text');
  const secondaryTextColor = useColorModeValue('gray.600', 'gray.300');
  const tertiaryTextColor = useColorModeValue('gray.500', 'gray.400');
  const searchBg = useColorModeValue('white', 'dark.surface');
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
  const grayBg = useColorModeValue('gray.50', 'gray.900');
  const grayHoverBg = useColorModeValue('gray.100', 'gray.800');
  const grayBorder = useColorModeValue('gray.300', 'gray.600');
  const grayTextColor = useColorModeValue('gray.700', 'gray.200');
  const graySecondaryTextColor = useColorModeValue('gray.600', 'gray.300');

  // 학생 그룹 분류 함수 (실제 클리닉 예약 데이터 반영)
  const getStudentGroup = (student: Student): 'mandatory' | 'required' | 'unrequired' | 'reserved' => {
    // 1. non_pass=True (테두리 빨간색) - 논패스 대상자
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
      // essential_clinic=False && 클리닉 예약 안함 (테두리 회색)
      return 'unrequired';
    }
  };

  // 학생 그룹별 스타일 반환
  const getStudentGroupStyle = (group: 'mandatory' | 'required' | 'unrequired' | 'reserved') => {
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
      case 'unrequired':
        return {
          bg: useColorModeValue('white', 'dark.surface'),
          borderColor: grayBorder,
          hoverBg: grayHoverBg,
          textColor: grayTextColor,
          secondaryTextColor: graySecondaryTextColor,
          colorScheme: 'gray' as const,
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

  // 검색어 및 필터에 따른 학생 필터링
  useEffect(() => {
    let filtered = students;

    // 검색어 필터링
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(student =>
        student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.school?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.grade?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 그룹 필터링
    if (activeFilter) {
      filtered = filtered.filter(student => getStudentGroup(student) === activeFilter);
    }

    // 필터링된 결과를 4그룹 순서대로 정렬
    const sortedFiltered = filtered.sort((a, b) => {
      const groupA = getStudentGroup(a);
      const groupB = getStudentGroup(b);
      
      // 그룹 우선순위: mandatory -> required -> unrequired -> reserved
      const groupOrder = { mandatory: 0, required: 1, unrequired: 2, reserved: 3 };
      
      if (groupA !== groupB) {
        return groupOrder[groupA] - groupOrder[groupB];
      }
      
      // 같은 그룹 내에서는 이름순으로 정렬
      return a.student_name.localeCompare(b.student_name, 'ko-KR');
    });
    setFilteredStudents(sortedFiltered);
  }, [searchTerm, students, activeFilter]);

  // 클리닉 예약 데이터 로드
  const loadClinicReservations = async () => {
    try {
      console.log('🔍 [MandatoryClinicModal] 클리닉 예약 데이터 로드 시작');
      
      // 현재 주의 시작일과 종료일 계산
      const now = new Date();
      const currentDay = now.getDay(); // 0 = 일요일, 1 = 월요일, ...
      
      // 이번 주 월요일 계산
      const monday = new Date(now);
      if (currentDay === 0) {
        // 일요일인 경우, 6일 전이 월요일
        monday.setDate(now.getDate() - 6);
      } else {
        // 월요일~토요일인 경우
        monday.setDate(now.getDate() - (currentDay - 1));
      }
      monday.setHours(0, 0, 0, 0);
      
      // 이번 주 일요일 계산
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      
      const mondayStr = monday.toISOString().split('T')[0]; // YYYY-MM-DD 형식
      const sundayStr = sunday.toISOString().split('T')[0]; // YYYY-MM-DD 형식
      
      console.log(`🔍 [MandatoryClinicModal] 이번 주 범위: ${mondayStr} ~ ${sundayStr}`);
      
      // ClinicAttendance API를 통해 모든 활성 예약 데이터 가져오기 (클라이언트에서 필터링)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinic-attendances/?is_active=true`, {
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
        
        // 이번 주 범위 내 예약 데이터만 필터링
        const allAttendances = Array.isArray(attendanceData) ? attendanceData : (attendanceData.results || []);
        const thisWeekAttendances = allAttendances.filter((attendance: any) => {
          const expectedDate = attendance.expected_clinic_date;
          if (!expectedDate) return false;
          return expectedDate >= mondayStr && expectedDate <= sundayStr;
        });
        
        console.log(`🔍 [MandatoryClinicModal] 전체 예약: ${allAttendances.length}개, 이번 주 예약: ${thisWeekAttendances.length}개`);
        
        thisWeekAttendances.forEach((attendance: any, index: number) => {
          console.log(`🔍 [MandatoryClinicModal] 이번 주 예약 ${index}:`, attendance);
          if (attendance.student) {
            reservedIds.add(attendance.student);
          }
        });
        
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
            
            // 그룹 우선순위: mandatory -> required -> unrequired -> reserved
            const groupOrder = { mandatory: 0, required: 1, unrequired: 2, reserved: 3 };
            
            if (groupA !== groupB) {
              return groupOrder[groupA] - groupOrder[groupB];
            }
            
            // 같은 그룹 내에서는 이름순으로 정렬
            return a.student_name.localeCompare(b.student_name, 'ko-KR');
          });
          
          setStudents(sortedStudents);
          setFilteredStudents(sortedStudents);
          console.log('🔍 [MandatoryClinicModal] 학생 데이터 로드 완료:', sortedStudents.length);
          console.log('🔍 [MandatoryClinicModal] 논패스 클리닉 대상자:', sortedStudents.filter(s => s.non_pass).length, '명');
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

  // 학생의 의무 클리닉 신청 상태 토글
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
      const groupOrder = { mandatory: 0, required: 1, unrequired: 2, reserved: 3 };
      
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
          
          const groupOrder = { mandatory: 0, required: 1, unrequired: 2, reserved: 3 };
          
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
        description: `${student.student_name} ${actualEssentialClinicStatus ? '의무 신청' : '신청 취소'}`,
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
        
        const groupOrder = { mandatory: 0, required: 1, unrequired: 2, reserved: 3 };
        
        if (groupA !== groupB) {
          return groupOrder[groupA] - groupOrder[groupB];
        }
        
        return a.student_name.localeCompare(b.student_name, 'ko-KR');
      });
      setStudents(sortedRolledBackStudents);
      
      // 상세한 오류 정보 표시
      let errorMessage = '의무 클리닉 신청 상태 변경에 실패했습니다.';
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

  // 학생의 논패스 클리닉 상태 토글 (최적화된 버전)
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
      const groupOrder = { mandatory: 0, required: 1, unrequired: 2, reserved: 3 };
      
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
          
          const groupOrder = { mandatory: 0, required: 1, unrequired: 2, reserved: 3 };
          
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
        description: `${student.student_name} ${actualNonPassStatus ? '논패스 설정' : '논패스 해제'}`,
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
        
        const groupOrder = { mandatory: 0, required: 1, unrequired: 2, reserved: 3 };
        
        if (groupA !== groupB) {
          return groupOrder[groupA] - groupOrder[groupB];
        }
        
        return a.student_name.localeCompare(b.student_name, 'ko-KR');
      });
      setStudents(sortedRolledBackStudents);
      
      // 상세한 오류 정보 표시
      let errorMessage = '논패스 클리닉 상태 변경에 실패했습니다.';
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

  // 토글 필터 핸들러
  const handleFilterToggle = (filter: 'mandatory' | 'required' | 'unrequired' | 'reserved') => {
    setActiveFilter(activeFilter === filter ? null : filter);
  };

  // 학생 예약 정보 모달 열기
  const openReservationInfo = async (student: Student) => {
    setSelectedStudent(student);
    
    try {
      // 현재 주의 시작일과 종료일 계산 (월요일~일요일)
      const now = new Date();
      const currentDay = now.getDay(); // 0 = 일요일, 1 = 월요일, ...
      
      // 이번 주 월요일 계산
      const monday = new Date(now);
      if (currentDay === 0) {
        // 일요일인 경우, 6일 전이 월요일
        monday.setDate(now.getDate() - 6);
      } else {
        // 월요일~토요일인 경우
        monday.setDate(now.getDate() - (currentDay - 1));
      }
      monday.setHours(0, 0, 0, 0);
      
      // 이번 주 일요일 계산
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      
      const mondayStr = monday.toISOString().split('T')[0]; // YYYY-MM-DD 형식
      const sundayStr = sunday.toISOString().split('T')[0]; // YYYY-MM-DD 형식
      
      console.log(`🔍 [MandatoryClinicModal] ${student.student_name} 예약 정보 - 이번 주 범위: ${mondayStr} ~ ${sundayStr}`);
      
      // 해당 학생의 모든 활성 예약 정보 가져오기 (클라이언트에서 필터링)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinic-attendances/?student=${student.id}&is_active=true`, {
        headers: {
          'Authorization': `Token ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const attendanceData = await response.json();
        const reservations: Array<{day: string, time: string, dayDisplay: string, clinicId: number, attendanceId: number, expectedDate: string}> = [];
        console.log('attendanceData', attendanceData);
        
        // 요일 매핑
        const dayMap: {[key: string]: string} = {
          'mon': '월요일',
          'tue': '화요일', 
          'wed': '수요일',
          'thu': '목요일',
          'fri': '금요일',
          'sat': '토요일',
          'sun': '일요일'
        };

        // 각 클리닉에서 해당 학생의 예약 정보만 필터링 + 이번 주 범위 필터링
        const results = Array.isArray(attendanceData) ? attendanceData : (attendanceData.results || []);
        const studentAttendances = results.filter((attendance: any) => {
          // 학생 ID 필터링
          if (attendance.student !== student.id) return false;
          
          // 이번 주 범위 필터링
          const expectedDate = attendance.expected_clinic_date;
          if (!expectedDate) return false;
          
          return expectedDate >= mondayStr && expectedDate <= sundayStr;
        });
        
        console.log(`🔍 [MandatoryClinicModal] ${student.student_name}의 이번 주 범위 필터링된 예약 정보:`, studentAttendances);
        console.log(`🔍 [MandatoryClinicModal] 범위: ${mondayStr} ~ ${sundayStr}`);
        
        // 클리닉 정보를 가져와서 요일/시간 정보 추출
        for (const attendance of studentAttendances) {
          try {
            const clinicResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinics/${attendance.clinic}/`, {
              headers: {
                'Authorization': `Token ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (clinicResponse.ok) {
              const clinic = await clinicResponse.json();
              reservations.push({
                day: clinic.clinic_day,
                time: clinic.clinic_time,
                dayDisplay: `${dayMap[clinic.clinic_day] || clinic.clinic_day} ${clinic.clinic_time}`,
                clinicId: attendance.clinic,
                attendanceId: attendance.id,
                expectedDate: attendance.expected_clinic_date
              });
            }
          } catch (error) {
            console.error('클리닉 정보 가져오기 실패:', error);
          }
        }
        
        console.log(`✅ [MandatoryClinicModal] ${student.student_name} 이번 주 예약 정보:`, reservations);
        setStudentReservations(reservations);
      } else {
        setStudentReservations([]);
      }
    } catch (error) {
      console.error('예약 정보 가져오기 실패:', error);
      setStudentReservations([]);
    }
    
    onReservationInfoOpen();
  };

  // 모달 닫기 시 검색어와 필터 초기화
  const handleClose = () => {
    setSearchTerm('');
    setActiveFilter(null);
    onClose();
  };

  // 클리닉 예약 해제 처리
  const handleCancelClinicReservation = async () => {
    if (!cancelingClinic || !selectedStudent) return;
    
    try {
      setUpdating(selectedStudent.id);
      
      // 클리닉 예약 해제 API 호출
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinic-attendances/${cancelingClinic.attendanceId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('✅ [MandatoryClinicModal] 클리닉 예약 해제 성공');
        
        // 예약 목록에서 해당 예약 제거
        const updatedReservations = studentReservations.filter(
          reservation => reservation.attendanceId !== cancelingClinic.attendanceId
        );
        setStudentReservations(updatedReservations);
        
        // 예약 데이터 새로고침 (메인 모달의 학생 리스트 업데이트)
        await Promise.all([
          loadClinicReservations(), // 전체 예약 데이터 업데이트
          (async () => {
            const studentsData = await getStudents();
            const sortedStudents = studentsData.sort((a, b) => {
              const groupA = getStudentGroup(a);
              const groupB = getStudentGroup(b);
              const groupOrder = { mandatory: 0, required: 1, unrequired: 2, reserved: 3 };
              if (groupA !== groupB) {
                return groupOrder[groupA] - groupOrder[groupB];
              }
              return a.student_name.localeCompare(b.student_name, 'ko-KR');
            });
            setStudents(sortedStudents);
            setFilteredStudents(sortedStudents);
          })()
        ]);
        
        toast({
          title: '해제 완료',
          description: `${selectedStudent.student_name}의 클리닉 예약이 해제되었습니다.`,
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
        
        // 모달 닫기
        onCancelModalClose();
        
        // 더 이상 예약이 없으면 예약 정보 모달도 닫기
        if (updatedReservations.length === 0) {
          onReservationInfoClose();
        }
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [MandatoryClinicModal] 클리닉 예약 해제 실패:', response.status, errorData);
        
        toast({
          title: '해제 실패',
          description: errorData.error || '클리닉 예약 해제에 실패했습니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('❌ [MandatoryClinicModal] 클리닉 예약 해제 오류:', error);
      toast({
        title: '네트워크 오류',
        description: '예약 해제 요청 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setUpdating(null);
      setCancelingClinic(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="6xl" isCentered>
      <ModalOverlay bg="useColorModeValue('gray.50', 'dark.background')" />
      <ModalContent 
        border={"1px"}
        borderColor={useColorModeValue('gray.200', 'dark.border')}
        maxH="90vh" 
        minH="90vh"
        minW="80vw"
        borderRadius="md"
        display="flex" 
        flexDirection="column"
        bg={useColorModeValue('white', 'dark.background')}
      >
        <ModalHeader bg={useColorModeValue('gray.50', 'dark.background')}>
          <VStack spacing={3} align="stretch" flex={1}>
            <Text fontSize="xl" fontWeight="bold" color={textColor}>
              클리닉 관리
            </Text>
            {/* 토글 필터 그룹 */}
            <HStack spacing={2} justify="center">
              <ButtonGroup size="sm" spacing={2}>
                <Button
                  colorScheme={activeFilter === 'mandatory' ? 'red' : 'gray'}
                  variant={activeFilter === 'mandatory' ? 'solid' : 'outline'}
                  onClick={() => handleFilterToggle('mandatory')}
                  borderColor={useColorModeValue('red.300', 'red.600')}
                >
                  논패스
                </Button>
                <Button
                  colorScheme={activeFilter === 'required' ? 'yellow' : 'gray'}
                  variant={activeFilter === 'required' ? 'solid' : 'outline'}
                  onClick={() => handleFilterToggle('required')}
                  borderColor={useColorModeValue('yellow.300', 'yellow.600')}
                >
                  의무
                </Button>
                <Button
                  colorScheme={activeFilter === 'unrequired' ? 'gray' : 'gray'}
                  variant={activeFilter === 'unrequired' ? 'solid' : 'outline'}
                  onClick={() => handleFilterToggle('unrequired')}
                  bg={activeFilter === 'unrequired' ? useColorModeValue('gray.500', 'gray.600') : 'transparent'}
                  color={activeFilter === 'unrequired' ? 'white' : useColorModeValue('gray.600', 'gray.300')}
                  _hover={{
                    bg: activeFilter === 'unrequired' ? useColorModeValue('gray.600', 'gray.500') : useColorModeValue('gray.100', 'gray.700')
                  }}
                  borderColor={useColorModeValue('gray.300', 'gray.600')}
                >
                  의무해제
                </Button>
                <Button
                  colorScheme={activeFilter === 'reserved' ? 'green' : 'gray'}
                  variant={activeFilter === 'reserved' ? 'solid' : 'outline'}
                  onClick={() => handleFilterToggle('reserved')}
                  borderColor={useColorModeValue('green.300', 'green.600')}
                >
                  예약함
                </Button>
              </ButtonGroup>
            </HStack>
          </VStack>
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
                          p={3}
                          variant="outline"
                          colorScheme={style.colorScheme}
                          bg={style.bg}
                          borderColor={style.borderColor}
                          _hover={{
                            bg: style.hoverBg,
                          }}
                          transition="all 0.15s ease-in-out"
                          onClick={(e) => {
                            const group = getStudentGroup(student);
                            
                            // 예약한 학생(reserved)인 경우: 예약 정보 모달 열기
                            if (group === 'reserved') {
                              openReservationInfo(student);
                              return;
                            }
                            
                            // 예약하지 않은 학생인 경우: 기존 토글 동작
                            // Shift + 클릭: essential_clinic 토글 (non_pass가 false일 때만)
                            if (e.shiftKey && !student.non_pass) {
                              handleToggleEssentialClinic(student);
                            } else {
                              handleToggleNonPass(student);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            const group = getStudentGroup(student);
                            
                            // 예약한 학생(reserved)인 경우: 예약 정보 모달 열기
                            if (group === 'reserved') {
                              openReservationInfo(student);
                              return;
                            }
                            
                            // 우클릭: essential_clinic 토글 (non_pass가 false일 때만)
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
                                    논패스
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
                                    의무
                                  </Badge>
                                )}
                                {group === 'unrequired' && (
                                  <Badge
                                    colorScheme="gray"
                                    variant="solid"
                                    fontSize="xs"
                                    px={2}
                                    py={1}
                                    flexShrink={0}
                                  >
                                    의무해제
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
                                    예약함
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
                            
                            {/* 의무화 토글 버튼 - non_pass가 false인 학생에게만 표시 */}
                            {!student.non_pass && (
                              <Box textAlign="left">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  bg={student.essential_clinic 
                                    ? useColorModeValue('blue.50', 'blue.900') 
                                    : useColorModeValue('gray.100', 'dark.surface')
                                  }
                                  borderColor={student.essential_clinic 
                                    ? useColorModeValue('blue.200', 'blue.600') 
                                    : useColorModeValue('gray.300', 'dark.border')
                                  }
                                  color={student.essential_clinic 
                                    ? useColorModeValue('blue.700', 'blue.200') 
                                    : useColorModeValue('gray.600', 'gray.400')
                                  }
                                  _hover={{
                                    bg: student.essential_clinic 
                                      ? useColorModeValue('blue.100', 'blue.800')
                                      : useColorModeValue('gray.200', 'gray.700'),
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation(); // 부모 버튼 클릭 이벤트 방지
                                    handleToggleEssentialClinic(student);
                                  }}
                                  isDisabled={updating === student.id}
                                  px={3}
                                  py={1}
                                  height="24px"
                                  fontSize="xs"
                                  fontWeight={student.essential_clinic ? "bold" : "normal"}
                                >
                                  의무화
                                </Button>
                              </Box>
                            )}
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
                  논패스 {students.filter(s => getStudentGroup(s) === 'mandatory').length}명
                </Text>
                {' / '}
                <Text as="span" fontWeight="bold" color="yellow.500">
                  의무 {students.filter(s => getStudentGroup(s) === 'required').length}명
                </Text>
                {' / '}
                <Text as="span" fontWeight="bold" color="gray.500">
                  의무해제 {students.filter(s => getStudentGroup(s) === 'unrequired').length}명
                </Text>
                {' / '}
                <Text as="span" fontWeight="bold" color="green.500">
                  예약함 {students.filter(s => getStudentGroup(s) === 'reserved').length}명
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

      {/* 예약 정보 모달 */}
      <Modal isOpen={isReservationInfoOpen} onClose={onReservationInfoClose} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent
          bg={bgColor} 
          color={textColor}
          border="1px"
          borderColor={borderColor}
          minW="70vw"
          p={1}
        >
          <ModalHeader>
            <VStack spacing={2} textAlign="center" align="stretch">
              <Text fontSize="lg" fontWeight="bold" color={textColor}>
                {selectedStudent?.student_name} 예약 현황
              </Text>
              <Text fontSize="sm" color={secondaryTextColor}>
                해제하려면 클리닉 박스를 클릭하세요
              </Text>
            </VStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {studentReservations.length > 0 ? (
              <VStack spacing={4} align="stretch">
                
                {/* 동적 그리드 레이아웃 */}
                <Box 
                  overflowX="auto"
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  px={{ base: 0.5, md: 0 }}
                  bg={useColorModeValue('white', 'dark.surface')}
                  width="100%"
                  height="100%"
                >
                  <Grid
                    // 고정된 그리드: 각 박스가 일정한 크기 유지
                    templateColumns="repeat(auto-fit, 140px)"
                    columnGap="1rem"
                    bg={useColorModeValue('white', 'dark.surface')}
                    rowGap="1rem"
                    w="100%"
                    h="100%"
                    maxW={{ base: "100%", md: "600px" }}
                    minW={{ base: "20px", md: "auto" }}
                    justifyContent="center"
                  >
                    {studentReservations.map((reservation, index) => {
                      // 요일 매핑
                      const dayNames: { [key: string]: string } = {
                        mon: '월',
                        tue: '화',
                        wed: '수',
                        thu: '목',
                        fri: '금',
                        sat: '토',
                        sun: '일'
                      };
                      
                      return (
                        <GridItem key={index}>
                          <Box
                            p={1}
                            aspectRatio={1}
                            border="1px solid"
                            borderColor={useColorModeValue('gray.300', 'dark.border')}
                            borderRadius="md"
                            bg={useColorModeValue('gray.50', 'dark.surface')}
                            _hover={{
                              shadow: "md",
                              cursor: "pointer",
                              bg: 'gray.700'
                            }}
                            transition="all 0.2s"
                            onClick={() => {
                              setCancelingClinic({
                                day: reservation.day,
                                time: reservation.time,
                                clinicId: reservation.clinicId,
                                attendanceId: reservation.attendanceId
                              });
                              onCancelModalOpen();
                            }}
                            position="relative"
                            role="button"
                            tabIndex={0}
                          >
                            <Box position="relative" height="100%" display="flex" flexDirection="column">
                              {/* 시간과 요일 표시 - 최상단 */}
                              <HStack justify="space-between" align="flex-start" mb={1}>
                                <Text 
                                  fontSize="sm"
                                  color={useColorModeValue('green.700', 'gray.200')}
                                  fontWeight="bold"
                                  lineHeight="1.2"
                                >
                                  {reservation.time}
                                </Text>
                                <Text 
                                  fontSize="xs"
                                  color={useColorModeValue('green.700', 'gray.200')}
                                  fontWeight="bold"
                                  lineHeight="1.2"
                                >
                                  {dayNames[reservation.day] || reservation.day}
                                </Text>
                              </HStack>
                              
                              {/* 중앙 영역 - expected_clinic_date 표시 */}
                              <Box
                                flex="1"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                flexDirection="column"
                              >
                                <Text
                                  fontSize="sm"
                                  fontWeight="bold"
                                  textAlign="center"
                                  color={useColorModeValue('green.700', 'gray.300')}
                                  mb={1}
                                >
                                  {reservation.expectedDate}
                                </Text>
                                <Text
                                  fontSize="xs"
                                  textAlign="center"
                                  color={useColorModeValue('green.600', 'gray.400')}
                                >
                                  클릭으로 해제
                                </Text>
                              </Box>
                            </Box>
                          </Box>
                        </GridItem>
                      );
                    })}
                  </Grid>
                </Box>
              </VStack>
            ) : (
              <Text color={secondaryTextColor}>
                예약 정보를 불러오는 중이거나 예약이 없습니다.
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 클리닉 배치 해제 확인 모달 */}
      <Modal isOpen={isCancelModalOpen} onClose={onCancelModalClose} size="sm" isCentered>
        <ModalOverlay />
        <ModalContent
          bg={bgColor} 
          color={textColor}
          border="1px"
          borderColor={borderColor}
        >
          <ModalHeader>
            <Text fontSize="lg" fontWeight="bold">
              클리닉 배치 해제
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {cancelingClinic && (
              <Text fontSize="md" textAlign="center" lineHeight="1.6">
                {(() => {
                  const dayNames: { [key: string]: string } = {
                    mon: '월요일',
                    tue: '화요일',
                    wed: '수요일',
                    thu: '목요일',
                    fri: '금요일',
                    sat: '토요일',
                    sun: '일요일'
                  };
                  return `${dayNames[cancelingClinic.day]} ${cancelingClinic.time} 클리닉을 배치 해제하시겠습니까?`;
                })()} 
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCancelModalClose}>
              취소
            </Button>
            <Button
              colorScheme="red"
              onClick={handleCancelClinicReservation}
              isLoading={updating !== null}
              loadingText="해제 중..."
            >
              확인
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Modal>
  );
};

export default MandatoryClinicModal;
