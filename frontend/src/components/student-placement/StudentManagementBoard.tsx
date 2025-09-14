'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Text,
  Input,
  InputGroup,
  InputLeftElement,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
  VStack,
  HStack,
  Grid,
  GridItem,
  Badge,
  Spinner,
  Center,
  useColorModeValue,
  ButtonGroup,
  Collapse
} from '@chakra-ui/react';
import { SearchIcon, ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { Student } from '@/lib/types';
import { getStudents, updateStudentNonPass, updateStudentEssentialClinic } from '@/lib/api';
import ClinicPlacementModal from './ClinicPlacementModal';

interface StudentManagementBoardProps {
  onRefresh?: () => void;
  onClinicDataUpdate?: (clinicId: number, studentId: number, isAdd: boolean) => void;
  onUpdateStudentNonPass?: (studentId: number, nonPass: boolean) => void;
}


const StudentManagementBoard: React.FC<StudentManagementBoardProps> = ({
  onRefresh,
  onClinicDataUpdate,
  onUpdateStudentNonPass
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [reservedStudentIds, setReservedStudentIds] = useState<Set<number>>(new Set());
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentReservations, setStudentReservations] = useState<Array<{
    day: string,
    time: string,
    dayDisplay: string,
    clinicId: number,
    attendanceId: number,
    expectedDate: string
  }>>([]);

  // Filter states
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toast = useToast();

  const { isOpen: isReservationInfoOpen, onOpen: onReservationInfoOpen, onClose: onReservationInfoClose } = useDisclosure();
  const { isOpen: isPlacementOpen, onOpen: onPlacementOpen, onClose: onPlacementClose } = useDisclosure();
  const [selectedStudentForPlacement, setSelectedStudentForPlacement] = useState<Student | null>(null);

  // Dark mode colors
  const bgColor = useColorModeValue('white', 'dark.surface');
  const borderColor = useColorModeValue('gray.300', 'dark.border');
  const textColor = useColorModeValue(useColorModeValue('gray.700', 'dark.text'), 'dark.text');
  const headerBg = useColorModeValue('gray.50', 'dark.background');
  const hoverBg = useColorModeValue('gray.50', 'dark.hover');

  // 학생 그룹 분류 함수 (실제 클리닉 예약 데이터 반영)
  const getStudentGroup = (student: Student): 'mandatory' | 'required' | 'unrequired' | 'reserved' => {
    if (student.non_pass) {
      return 'mandatory';
    }

    const hasReservation = reservedStudentIds.has(student.id);

    if (hasReservation) {
      return 'reserved';
    } else if (student.essential_clinic === true) {
      return 'required';
    } else {
      return 'unrequired';
    }
  };

  // 클리닉 예약 데이터 로드
  const loadClinicReservations = async () => {
    try {

      const now = new Date();
      const currentDay = now.getDay();
      const monday = new Date(now);
      if (currentDay === 0) {
        monday.setDate(now.getDate() - 6);
      } else {
        monday.setDate(now.getDate() - (currentDay - 1));
      }
      monday.setHours(0, 0, 0, 0);
      console.log('🔍 [StudentManagementBoard] 월요일:', monday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const mondayStr = monday.toISOString().split('T')[0];
      const sundayStr = sunday.toISOString().split('T')[0];

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinic-attendances/?is_active=true`, {
        headers: {
          'Authorization': `Token ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const attendanceData = await response.json();
        const reservedIds = new Set<number>();

        const allAttendances = Array.isArray(attendanceData) ? attendanceData : (attendanceData.results || []);
        const thisWeekAttendances = allAttendances.filter((attendance: any) => {
          const expectedDate = attendance.expected_clinic_date;
          if (!expectedDate) return false;
          return expectedDate >= mondayStr && expectedDate <= sundayStr;
        });

        thisWeekAttendances.forEach((attendance: any) => {
          if (attendance.student) {
            reservedIds.add(attendance.student);
          }
        });

        setReservedStudentIds(reservedIds);
      }
    } catch (error) {
      console.error('❌ [StudentManagementBoard] 예약 데이터 로드 오류:', error);
    }
  };

  // 학생 데이터 로드
  const loadStudents = async () => {
    try {
      setLoading(true);

      await Promise.all([
        loadClinicReservations(),
        (async () => {
          const studentsData = await getStudents();

          // 이름순 오름차순으로 정렬
          const sortedStudents = studentsData.sort((a, b) =>
            a.student_name.localeCompare(b.student_name, 'ko-KR')
          );

          setStudents(sortedStudents);
          setFilteredStudents(sortedStudents);
        })()
      ]);
    } catch (error) {
      console.error('❌ [StudentManagementBoard] 학생 데이터 로드 실패:', error);
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

  // 초기 데이터 로드
  useEffect(() => {
    loadStudents();
  }, []);

  // 검색어 및 필터에 따른 학생 필터링 및 이름순 정렬
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

    // 학교 필터링
    if (schoolFilter !== 'all') {
      filtered = filtered.filter(student => student.school === schoolFilter);
    }

    // 학년 필터링
    if (gradeFilter !== 'all') {
      filtered = filtered.filter(student => student.grade === gradeFilter);
    }

    // 상태 필터링
    if (statusFilter !== 'all') {
      filtered = filtered.filter(student => {
        const group = getStudentGroup(student);
        switch (statusFilter) {
          case 'non_pass':
            return group === 'mandatory';
          case 'essential':
            return group === 'required';
          case 'essential_released':
            return group === 'unrequired';
          case 'reserved':
            return group === 'reserved';
          default:
            return true;
        }
      });
    }

    // 이름순 오름차순 정렬
    filtered = filtered.sort((a, b) =>
      a.student_name.localeCompare(b.student_name, 'ko-KR')
    );

    setFilteredStudents(filtered);
  }, [searchTerm, students, schoolFilter, gradeFilter, statusFilter, reservedStudentIds]);

  // 학생의 논패스 상태 토글
  const handleToggleNonPass = async (student: Student) => {
    const newNonPassStatus = !student.non_pass;

    setUpdating(student.id);

    try {
      const response = await updateStudentNonPass(student.id, newNonPassStatus);

      setStudents(prevStudents =>
        prevStudents.map(s =>
          s.id === student.id ? { ...s, non_pass: response.non_pass } : s
        )
      );

      if (onUpdateStudentNonPass) {
        onUpdateStudentNonPass(student.id, response.non_pass);
      }

      toast({
        title: '완료',
        description: `${student.student_name} ${response.non_pass ? '논패스 설정' : '논패스 해제'}`,
        status: 'success',
        duration: 1000,
        isClosable: true,
      });

    } catch (error) {
      console.error('❌ [StudentManagementBoard] 논패스 상태 업데이트 실패:', error);
      toast({
        title: '변경 실패',
        description: '논패스 상태 변경에 실패했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setTimeout(() => {
        setUpdating(null);
      }, 200);
    }
  };

  // 학생의 의무 클리닉 상태 토글
  const handleToggleEssentialClinic = async (student: Student) => {
    const newEssentialClinicStatus = !student.essential_clinic;

    setUpdating(student.id);

    try {
      const response = await updateStudentEssentialClinic(student.id, newEssentialClinicStatus);

      setStudents(prevStudents =>
        prevStudents.map(s =>
          s.id === student.id ? { ...s, essential_clinic: response.essential_clinic } : s
        )
      );

      toast({
        title: '완료',
        description: `${student.student_name} ${response.essential_clinic ? '의무 신청' : '신청 취소'}`,
        status: 'success',
        duration: 1000,
        isClosable: true,
      });

    } catch (error) {
      console.error('❌ [StudentManagementBoard] essential_clinic 상태 업데이트 실패:', error);
      toast({
        title: '변경 실패',
        description: '의무 클리닉 신청 상태 변경에 실패했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setTimeout(() => {
        setUpdating(null);
      }, 200);
    }
  };

  // 학생 예약 정보 모달 열기
  const openReservationInfo = async (student: Student) => {
    setSelectedStudent(student);

    try {
      const now = new Date();
      const currentDay = now.getDay();

      const monday = new Date(now);
      if (currentDay === 0) {
        monday.setDate(now.getDate() - 6);
      } else {
        monday.setDate(now.getDate() - (currentDay - 1));
      }
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const mondayStr = monday.toISOString().split('T')[0];
      const sundayStr = sunday.toISOString().split('T')[0];

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/clinic-attendances/?student=${student.id}&is_active=true`, {
        headers: {
          'Authorization': `Token ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const attendanceData = await response.json();
        const reservations: Array<{
          day: string,
          time: string,
          dayDisplay: string,
          clinicId: number,
          attendanceId: number,
          expectedDate: string
        }> = [];

        const dayMap: {[key: string]: string} = {
          'mon': '월요일',
          'tue': '화요일',
          'wed': '수요일',
          'thu': '목요일',
          'fri': '금요일',
          'sat': '토요일',
          'sun': '일요일'
        };

        const results = Array.isArray(attendanceData) ? attendanceData : (attendanceData.results || []);
        const studentAttendances = results.filter((attendance: any) => {
          if (attendance.student !== student.id) return false;
          const expectedDate = attendance.expected_clinic_date;
          if (!expectedDate) return false;
          return expectedDate >= mondayStr && expectedDate <= sundayStr;
        });

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

  // 클리닉 배치 모달 열기
  const handleOpenPlacementModal = (student: Student) => {
    setSelectedStudentForPlacement(student);
    onPlacementOpen();
  };

  // 클리닉 배치 처리
  const handlePlaceStudentToClinic = async (clinicId: number, studentId: number) => {
    try {
      const { assignStudentToClinic } = await import('@/lib/api');
      await assignStudentToClinic(clinicId, [studentId]);

      if (onClinicDataUpdate) {
        onClinicDataUpdate(clinicId, studentId, true);
      }

      await loadStudents();

    } catch (error) {
      console.error('❌ [StudentManagementBoard] 학생 클리닉 배치 오류:', error);
      throw error;
    }
  };

  return (
    <Box
      bg={bgColor}
      borderRadius="md"
      border="0px"
      borderColor={borderColor}
      width="100%"
      color={textColor}
      height="100%"
      display="flex"
      flexDirection="column"
    >
      {/* 헤더 - 필터 버튼들과 토글 */}
      <Box p={4} pb={2} bg={headerBg} borderRadius="md">
        <HStack justify="space-between" align="flex-start" alignItems="center" mb={2}>
          <Text fontSize="lg" fontWeight="bold">
            학생 관리
          </Text>

          {/* 접기/펴기 토글 버튼 */}
          <Button
            size="md"
            variant="ghost"
            onClick={() => setIsCollapsed(!isCollapsed)}
            leftIcon={isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
          >
            {isCollapsed ? '펼치기' : '접기'}
          </Button>
        </HStack>

        {/* 필터들과 검색란 - 접기/펴기 적용 */}
        <Collapse in={!isCollapsed} animateOpacity>
          <VStack align="flex-start" spacing={3} mb={4}>
            {/* 필터 버튼 그룹들 */}
            <HStack spacing={6} flexWrap="wrap">
              {/* 학교 그룹 */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="sm" color={useColorModeValue(useColorModeValue('gray.600', 'gray.300'), 'dark.textSecondary')}>학교</Text>
                <ButtonGroup size="sm" isAttached>
                  <Button
                    colorScheme={schoolFilter === 'all' ? 'blue' : 'gray'}
                    variant="solid"
                    bg={schoolFilter === 'all' ? 'blue.500' : useColorModeValue(useColorModeValue('gray.100', 'dark.surface2'), 'dark.surface2')}
                    color={schoolFilter === 'all' ? 'white' : useColorModeValue(useColorModeValue('gray.700', 'dark.text'), 'dark.text')}
                    _hover={{
                      bg: schoolFilter === 'all' ? 'blue.600' : useColorModeValue(useColorModeValue('gray.200', 'dark.hover'), 'dark.hover')
                    }}
                    onClick={() => setSchoolFilter('all')}
                  >
                    전체
                  </Button>
                  <Button
                    colorScheme={schoolFilter === '세화고' ? 'blue' : 'gray'}
                    variant="solid"
                    bg={schoolFilter === '세화고' ? 'blue.500' : useColorModeValue(useColorModeValue('gray.100', 'dark.surface2'), 'dark.surface2')}
                    color={schoolFilter === '세화고' ? 'white' : useColorModeValue(useColorModeValue('gray.700', 'dark.text'), 'dark.text')}
                    _hover={{
                      bg: schoolFilter === '세화고' ? 'blue.600' : useColorModeValue(useColorModeValue('gray.200', 'dark.hover'), 'dark.hover')
                    }}
                    onClick={() => setSchoolFilter('세화고')}
                  >
                    세화고
                  </Button>
                  <Button
                    colorScheme={schoolFilter === '세화여고' ? 'blue' : 'gray'}
                    variant="solid"
                    bg={schoolFilter === '세화여고' ? 'blue.500' : useColorModeValue(useColorModeValue('gray.100', 'dark.surface2'), 'dark.surface2')}
                    color={schoolFilter === '세화여고' ? 'white' : useColorModeValue(useColorModeValue('gray.700', 'dark.text'), 'dark.text')}
                    _hover={{
                      bg: schoolFilter === '세화여고' ? 'blue.600' : useColorModeValue(useColorModeValue('gray.200', 'dark.hover'), 'dark.hover')
                    }}
                    onClick={() => setSchoolFilter('세화여고')}
                  >
                    세화여고
                  </Button>
                </ButtonGroup>
              </VStack>

              {/* 학년 그룹 */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="sm" color={useColorModeValue(useColorModeValue('gray.600', 'gray.300'), 'dark.textSecondary')}>학년</Text>
                <ButtonGroup size="sm" isAttached>
                  <Button
                    colorScheme={gradeFilter === 'all' ? 'blue' : 'gray'}
                    variant="solid"
                    bg={gradeFilter === 'all' ? 'blue.500' : useColorModeValue(useColorModeValue('gray.100', 'dark.surface2'), 'dark.surface2')}
                    color={gradeFilter === 'all' ? 'white' : useColorModeValue(useColorModeValue('gray.700', 'dark.text'), 'dark.text')}
                    _hover={{
                      bg: gradeFilter === 'all' ? 'blue.600' : useColorModeValue(useColorModeValue('gray.200', 'dark.hover'), 'dark.hover')
                    }}
                    onClick={() => setGradeFilter('all')}
                  >
                    전체
                  </Button>
                  <Button
                    colorScheme={gradeFilter === '1학년' ? 'blue' : 'gray'}
                    variant="solid"
                    bg={gradeFilter === '1학년' ? 'blue.500' : useColorModeValue('gray.100', 'dark.surface2')}
                    color={gradeFilter === '1학년' ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                    _hover={{
                      bg: gradeFilter === '1학년' ? 'blue.600' : useColorModeValue('gray.200', 'dark.hover')
                    }}
                    onClick={() => setGradeFilter('1학년')}
                  >
                    1학년
                  </Button>
                  <Button
                    colorScheme={gradeFilter === '2학년' ? 'blue' : 'gray'}
                    variant="solid"
                    bg={gradeFilter === '2학년' ? 'blue.500' : useColorModeValue('gray.100', 'dark.surface2')}
                    color={gradeFilter === '2학년' ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                    _hover={{
                      bg: gradeFilter === '2학년' ? 'blue.600' : useColorModeValue('gray.200', 'dark.hover')
                    }}
                    onClick={() => setGradeFilter('2학년')}
                  >
                    2학년
                  </Button>
                  <Button
                    colorScheme={gradeFilter === '3학년' ? 'blue' : 'gray'}
                    variant="solid"
                    bg={gradeFilter === '3학년' ? 'blue.500' : useColorModeValue('gray.100', 'dark.surface2')}
                    color={gradeFilter === '3학년' ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                    _hover={{
                      bg: gradeFilter === '3학년' ? 'blue.600' : useColorModeValue('gray.200', 'dark.hover')
                    }}
                    onClick={() => setGradeFilter('3학년')}
                  >
                    3학년
                  </Button>
                </ButtonGroup>
              </VStack>

              {/* 상태 그룹 */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="sm" color={useColorModeValue(useColorModeValue('gray.600', 'gray.300'), 'dark.textSecondary')}>상태</Text>
                <ButtonGroup size="sm" isAttached>
                  <Button
                    colorScheme={statusFilter === 'all' ? 'blue' : 'gray'}
                    variant="solid"
                    bg={statusFilter === 'all' ? 'blue.500' : useColorModeValue('gray.100', 'dark.surface2')}
                    color={statusFilter === 'all' ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                    _hover={{
                      bg: statusFilter === 'all' ? 'blue.600' : useColorModeValue('gray.200', 'dark.hover')
                    }}
                    onClick={() => setStatusFilter('all')}
                  >
                    전체
                  </Button>
                  <Button
                    colorScheme={statusFilter === 'non_pass' ? 'red' : 'gray'}
                    variant="solid"
                    bg={statusFilter === 'non_pass' ? 'red.500' : useColorModeValue('gray.100', 'dark.surface2')}
                    color={statusFilter === 'non_pass' ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                    _hover={{
                      bg: statusFilter === 'non_pass' ? 'red.600' : useColorModeValue('gray.200', 'dark.hover')
                    }}
                    onClick={() => setStatusFilter('non_pass')}
                  >
                    논패스
                  </Button>
                  <Button
                    colorScheme={statusFilter === 'essential' ? 'yellow' : 'gray'}
                    variant="solid"
                    bg={statusFilter === 'essential' ? 'yellow.500' : useColorModeValue('gray.100', 'dark.surface2')}
                    color={statusFilter === 'essential' ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                    _hover={{
                      bg: statusFilter === 'essential' ? 'yellow.600' : useColorModeValue('gray.200', 'dark.hover')
                    }}
                    onClick={() => setStatusFilter('essential')}
                  >
                    의무
                  </Button>
                  <Button
                    colorScheme={statusFilter === 'essential_released' ? 'gray' : 'gray'}
                    variant="solid"
                    bg={statusFilter === 'essential_released' ? useColorModeValue('gray.500', 'gray.400') : useColorModeValue('gray.100', 'dark.surface2')}
                    color={statusFilter === 'essential_released' ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                    _hover={{
                      bg: statusFilter === 'essential_released' ? useColorModeValue('gray.600', 'gray.300') : useColorModeValue('gray.200', 'dark.hover')
                    }}
                    onClick={() => setStatusFilter('essential_released')}
                  >
                    의무해제
                  </Button>
                  <Button
                    colorScheme={statusFilter === 'reserved' ? 'green' : 'gray'}
                    variant="solid"
                    bg={statusFilter === 'reserved' ? 'green.500' : useColorModeValue('gray.100', 'dark.surface2')}
                    color={statusFilter === 'reserved' ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                    _hover={{
                      bg: statusFilter === 'reserved' ? 'green.600' : useColorModeValue('gray.200', 'dark.hover')
                    }}
                    onClick={() => setStatusFilter('reserved')}
                  >
                    예약함
                  </Button>
                </ButtonGroup>
              </VStack>
            </HStack>
          </VStack>

          {/* 검색 입력란 */}
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="학생 이름, 아이디, 학교, 학년으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              bg={useColorModeValue('white', 'dark.surface')}
              borderColor={borderColor}
            />
          </InputGroup>
        </Collapse>
      </Box>

      {/* 테이블과 학생 목록 - 접기/펴기 애니메이션 적용 */}
      <Collapse in={!isCollapsed} animateOpacity>
        {/* 테이블 헤더 */}
        <Box bg={headerBg} borderY="1px" borderColor={borderColor}>
          <Box as="ul" listStyleType="none" m={0} p={0}>
            <Box
              as="li"
              display="grid"
              gridTemplateColumns="0.3fr 0.3fr 1fr 1fr 1fr 2fr"
              gap={4}
              p={3}
              fontWeight="bold"
              fontSize="sm"
            >
              <Text>학교</Text>
              <Text>학년</Text>
              <Text>이름</Text>
              <Text>학생번호</Text>
              <Text>학부모번호</Text>
              <Text>액션</Text>
            </Box>
          </Box>
        </Box>

        {/* 학생 목록 */}
        <Box flex={1} overflowY="auto">
        {loading ? (
          <Center py={8}>
            <VStack spacing={4}>
              <Spinner size="lg" color="blue.500" />
              <Text>학생 명단을 불러오는 중...</Text>
            </VStack>
          </Center>
        ) : filteredStudents.length === 0 ? (
          <Center py={8}>
            <Text color="gray.500">
              {searchTerm ? '검색 결과가 없습니다.' : '학생이 없습니다.'}
            </Text>
          </Center>
        ) : (
          <Box as="ul" listStyleType="none" m={0} p={0}>
            {filteredStudents.map((student) => {
              const group = getStudentGroup(student);

              return (
                <Box
                  key={student.id}
                  as="li"
                  display="grid"
                  gridTemplateColumns="0.3fr 0.3fr 1fr 1fr 1fr 2fr"
                  gap={4}
                  p={3}
                  borderBottom="1px"
                  borderColor={borderColor}
                  _hover={{ bg: hoverBg }}
                  fontSize="sm"
                >
                  <Text>{student.school}</Text>
                  <Text>{student.grade}</Text>
                  <HStack>
                    <Text>{student.student_name}</Text>
                    {student.non_pass && (
                      <Badge colorScheme="red" variant="solid" fontSize="xs">
                        논패스
                      </Badge>
                    )}
                    {student.essential_clinic && (
                      <Badge colorScheme="yellow" variant="solid" fontSize="xs">
                        의무
                      </Badge>
                    )}
                    {group === 'reserved' && (
                      <Badge colorScheme="green" variant="solid" fontSize="xs">
                        예약함
                      </Badge>
                    )}
                  </HStack>
                  <Text>{student.student_phone_num || '-'}</Text>
                  <Text>{student.student_parent_phone_num || '-'}</Text>
                  <HStack spacing={1} flexWrap="wrap">
                    <Button
                      size="xs"
                      variant="solid"
                      bg={student.non_pass ? 'red.600' : useColorModeValue('gray.100', 'dark.surface2')}
                      color={student.non_pass ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                      _hover={{
                        bg: student.non_pass ? 'red.600' : useColorModeValue('gray.200', 'dark.hover')
                      }}
                      onClick={() => handleToggleNonPass(student)}
                      isLoading={updating === student.id}
                      isDisabled={updating !== null && updating !== student.id}
                    >
                      논패스
                    </Button>
                    <Button
                      size="xs"
                      variant="solid"
                      bg={student.essential_clinic ? 'blue.500' : useColorModeValue('gray.100', 'dark.surface2')}
                      color={student.essential_clinic ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                      _hover={{
                        bg: student.essential_clinic ? 'blue.600' : useColorModeValue('gray.200', 'dark.hover')
                      }}
                      onClick={() => handleToggleEssentialClinic(student)}
                      isLoading={updating === student.id}
                      isDisabled={updating !== null && updating !== student.id}
                    >
                      의무
                    </Button>
                    <Button
                      size="xs"
                      variant="solid"
                      bg={group === 'reserved' ? 'green.500' : useColorModeValue('gray.100', 'dark.surface2')}
                      color={group === 'reserved' ? 'white' : useColorModeValue('gray.700', 'dark.text')}
                      _hover={{
                        bg: group === 'reserved' ? 'green.600' : useColorModeValue('gray.200', 'dark.hover')
                      }}
                      onClick={group === 'reserved' ? () => openReservationInfo(student) : undefined}
                      isDisabled={group !== 'reserved'}
                      _disabled={{
                        opacity: 0.6,
                        cursor: 'not-allowed',
                        bg: useColorModeValue('gray.100', 'dark.surface2'),
                        color: useColorModeValue('gray.700', 'dark.text')
                      }}
                    >
                      예약확인
                    </Button>
                    <Button
                      size="xs"
                      variant="solid"
                      bg="purple.500"
                      color="white"
                      _hover={{
                        bg: 'purple.600'
                      }}
                      onClick={() => handleOpenPlacementModal(student)}
                    >
                      클리닉배치
                    </Button>
                  </HStack>
                </Box>
              );
            })}
          </Box>
        )}
        </Box>
      </Collapse>

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
              <Text fontSize="lg" fontWeight="bold">
                {selectedStudent?.student_name} 예약 현황
              </Text>
              <Text fontSize="sm" color="gray.500">
                해제하려면 클리닉 박스를 클릭하세요
              </Text>
            </VStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {studentReservations.length > 0 ? (
              <VStack spacing={4} align="stretch">
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
                            borderColor={borderColor}
                            borderRadius="md"
                            bg={useColorModeValue('gray.50', 'dark.surface')}
                            _hover={{
                              shadow: "md",
                              cursor: "pointer",
                              bg: useColorModeValue('gray.700', 'dark.text')
                            }}
                            transition="all 0.2s"
                            position="relative"
                            role="button"
                            tabIndex={0}
                          >
                            <Box position="relative" height="100%" display="flex" flexDirection="column">
                              <HStack justify="space-between" align="flex-start" mb={1}>
                                <Text
                                  fontSize="sm"
                                  color={useColorModeValue('green.700', useColorModeValue('gray.200', 'dark.hover'))}
                                  fontWeight="bold"
                                  lineHeight="1.2"
                                >
                                  {reservation.time}
                                </Text>
                                <Text
                                  fontSize="xs"
                                  color={useColorModeValue('green.700', useColorModeValue('gray.200', 'dark.hover'))}
                                  fontWeight="bold"
                                  lineHeight="1.2"
                                >
                                  {dayNames[reservation.day] || reservation.day}
                                </Text>
                              </HStack>

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
              <Text color="gray.500">
                예약 정보를 불러오는 중이거나 예약이 없습니다.
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 클리닉 배치 모달 */}
      <ClinicPlacementModal
        isOpen={isPlacementOpen}
        onClose={() => {
          setSelectedStudentForPlacement(null);
          onPlacementClose();
        }}
        selectedStudent={selectedStudentForPlacement}
        onPlaceStudent={handlePlaceStudentToClinic}
        onClinicDataUpdate={onClinicDataUpdate}
        onUpdateStudentNonPass={onUpdateStudentNonPass}
        onUnassignStudent={async () => {}}
      />
    </Box>
  );
};

export default StudentManagementBoard;