'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Flex,
  Spinner,
  Center,
  Divider,
  useToast,
  Card,
  CardHeader,
  CardBody,
  Heading,
  IconButton,
  Button,
  ButtonGroup
} from '@chakra-ui/react';
import { InfoIcon } from '@chakra-ui/icons';
import { Clinic, User, DAY_CHOICES } from '@/lib/types';
import { getClinics, getStudents, getClinicAttendances, updateAttendance, getOrCreateAttendance } from '@/lib/api';
import { AuthGuard } from '@/lib/authGuard';

// 출석 상태 타입 정의
type AttendanceType = 'attended' | 'absent' | 'sick' | 'late' | 'none';

// 출석 상태 매핑
const ATTENDANCE_OPTIONS: { value: AttendanceType; label: string; color: string }[] = [
  { value: 'attended', label: '출석', color: 'green' },
  { value: 'absent', label: '결석', color: 'red' },
  { value: 'late', label: '지각', color: 'yellow' },
  { value: 'sick', label: '병결', color: 'blue' },
];

// 시간대 선택지 정의
const TIME_SLOTS = ['18:00', '19:00', '20:00', '21:00'];

// 요일 매핑 함수
const getTodayDay = (): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' => {
  const today = new Date();
  const dayMapping: { [key: number]: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' } = {
    0: 'sun', // 일요일
    1: 'mon', // 월요일
    2: 'tue', // 화요일
    3: 'wed', // 수요일
    4: 'thu', // 목요일
    5: 'fri', // 금요일
    6: 'sat', // 토요일
  };
  return dayMapping[today.getDay()];
};

// 과목명 한글 변환 함수
const getKoreanSubjectName = (subject: any): string => {
  // 과목 객체에서 한글 이름을 가져오거나, 영어 이름을 한글로 변환
  if (subject?.subject_kr) {
    return subject.subject_kr;  
  }
  
  if (subject?.subject) {
    const subjectMap: { [key: string]: string } = {
      'physics1': '물리학1',
      'physics2': '물리학2', 
      'chemistry1': '화학1',
      'chemistry2': '화학2',
      'biology1': '생명과학1',
      'biology2': '생명과학2',
      'earth1': '지구과학1',
      'earth2': '지구과학2',
      'math1': '수학1',
      'math2': '수학2',
      'mathA': '미적분',
      'mathB': '기하',
      'mathC': '확률과통계',
    };
    return subjectMap[subject.subject] || subject.subject;
  }
  
  return '과목 없음';
};

/**
 * 오늘의 클리닉 페이지 컴포넌트
 * 오늘 요일에 해당하는 클리닉들의 출석 관리를 위한 페이지
 */
const TodayClinicPageContent: React.FC = () => {
  const toast = useToast();
  const [clinics, setClinics] = useState<Clinic[]>([]); // 모든 클리닉 데이터
  const [students, setStudents] = useState<User[]>([]); // 모든 학생 데이터
  const [isLoading, setIsLoading] = useState(true); // 로딩 상태
  const [selectedTabIndex, setSelectedTabIndex] = useState(0); // 선택된 탭 인덱스
  // 출석 상태 관리 - 각 학생별 출석 상태를 저장
  const [attendanceStates, setAttendanceStates] = useState<{ [key: string]: AttendanceType }>({});
  // 출석 데이터 ID 매핑 - API 업데이트를 위해 필요
  const [attendanceIds, setAttendanceIds] = useState<{ [key: string]: number }>({});
  
  const today = getTodayDay(); // 오늘 요일
  const dayDisplay = DAY_CHOICES.find(d => d.value === today)?.label || today; // 요일 한글 표시

  // 오늘 요일의 시간대별 클리닉 찾기
  const todayClinics = TIME_SLOTS.map(timeSlot => 
    clinics.find(clinic => clinic.clinic_day === today && clinic.clinic_time === timeSlot)
  );

  // 출석 데이터 로드 함수
  const loadAttendanceData = async (clinic: Clinic) => {
    try {
      console.log(`📋 [DEBUG] === 출석 데이터 로드 시작 - 클리닉 ${clinic.id} ===`);
      
      // 해당 클리닉의 출석 데이터 조회
      console.log(`📋 [DEBUG] getClinicAttendances 호출 - 클리닉 ID: ${clinic.id}`);
      console.log(`📋 [DEBUG] 클리닉 정보:`, {
        id: clinic.id,
        clinic_day: clinic.clinic_day,
        clinic_time: clinic.clinic_time,
        clinic_students: clinic.clinic_students?.map(s => ({id: s.id, name: s.name})) || []
      });
      
      // 오늘의 클리닉에 해당하는 출석 데이터만 조회 (개선된 로직)
      console.log(`📋 [DEBUG] 오늘의 클리닉 출석 데이터 조회`);
      
      // 날짜 파라미터 없이 호출하면 백엔드에서 자동으로 오늘의 클리닉 데이터만 필터링
      const attendances = await getClinicAttendances(clinic.id);
      console.log(`📋 [DEBUG] API 응답 받은 출석 데이터:`, attendances);
      console.log(`📋 [DEBUG] 출석 데이터 개수:`, attendances.length);
      
      // 상태 업데이트
      const newAttendanceStates: { [key: string]: AttendanceType } = {};
      const newAttendanceIds: { [key: string]: number } = {};
      
      attendances.forEach((attendance: any, index: number) => {
        const stateKey = `${clinic.id}-${attendance.student}`;
        newAttendanceStates[stateKey] = attendance.attendance_type;
        newAttendanceIds[stateKey] = attendance.id;
        
        console.log(`📋 [DEBUG] [${index + 1}] 출석 데이터 처리:`);
        console.log(`📋 [DEBUG]   - 출석 ID: ${attendance.id}`);
        console.log(`📋 [DEBUG]   - 학생 ID: ${attendance.student}`);
        console.log(`📋 [DEBUG]   - 출석 상태: ${attendance.attendance_type}`);
        console.log(`📋 [DEBUG]   - 상태 키: ${stateKey}`);
        console.log(`📋 [DEBUG]   - 원본 데이터:`, attendance);
      });
      
      console.log(`📋 [DEBUG] 생성된 attendanceStates:`, newAttendanceStates);
      console.log(`📋 [DEBUG] 생성된 attendanceIds:`, newAttendanceIds);
      
      setAttendanceStates(prev => ({ ...prev, ...newAttendanceStates }));
      setAttendanceIds(prev => ({ ...prev, ...newAttendanceIds }));
      
      console.log(`✅ [DEBUG] 출석 데이터 로드 완료 - 클리닉 ${clinic.id}:`, attendances.length, '건');
      
          } catch (error) {
        console.error(`❌ [DEBUG] 출석 데이터 로드 오류 - 클리닉 ${clinic.id}:`, error);
        console.error(`❌ [DEBUG] 오류 상세:`, {
          message: (error as any)?.message,
          response: (error as any)?.response?.data,
          status: (error as any)?.response?.status
        });
      }
  };

  // 출석 상태 업데이트 함수
  const handleAttendanceChange = async (clinicId: number, studentId: number, attendanceType: AttendanceType) => {
    try {
      // 상태 키 생성 (클리닉ID-학생ID)
      const stateKey = `${clinicId}-${studentId}`;
      
      // === 디버깅 로그 시작 ===
      console.log('🎯 [DEBUG] === 출석 상태 업데이트 시작 ===');
      console.log('🎯 [DEBUG] 클리닉 ID:', clinicId);
      console.log('🎯 [DEBUG] 학생 ID:', studentId);
      console.log('🎯 [DEBUG] 변경할 출석 상태:', attendanceType);
      console.log('🎯 [DEBUG] 상태 키:', stateKey);
      
      // 현재 상태 정보 출력
      console.log('🎯 [DEBUG] === 현재 상태 정보 ===');
      console.log('🎯 [DEBUG] 전체 attendanceStates:', attendanceStates);
      console.log('🎯 [DEBUG] 현재 학생의 출석 상태:', attendanceStates[stateKey]);
      console.log('🎯 [DEBUG] 전체 attendanceIds:', attendanceIds);
      console.log('🎯 [DEBUG] 현재 학생의 출석 ID:', attendanceIds[stateKey]);
      
      // 즉시 UI 업데이트 (낙관적 업데이트)
      setAttendanceStates(prev => ({
        ...prev,
        [stateKey]: attendanceType
      }));

      // 출석 데이터 ID 확인
      const attendanceId = attendanceIds[stateKey];
      console.log('🎯 [DEBUG] 찾은 출석 ID:', attendanceId);

      if (!attendanceId) {
        console.error('❌ [DEBUG] 출석 ID를 찾을 수 없음!');
        console.error('❌ [DEBUG] 가능한 attendanceIds 키들:', Object.keys(attendanceIds));
        console.error('❌ [DEBUG] 찾고 있는 키:', stateKey);
        throw new Error('출석 데이터를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
      }

      // API 호출
      console.log('🎯 [DEBUG] API 호출 시작 - updateAttendance:', attendanceId, attendanceType);
      const result = await updateAttendance(attendanceId, attendanceType);
      console.log('🎯 [DEBUG] API 호출 결과:', result);

      toast({
        title: '출석 상태 업데이트 완료',
        description: `출석 상태가 '${attendanceType === 'attended' ? '출석' : 
                      attendanceType === 'absent' ? '결석' : 
                      attendanceType === 'late' ? '지각' : 
                      attendanceType === 'sick' ? '병결' : '미정'}'으로 변경되었습니다.`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });

    } catch (error) {
      console.error('❌ [DEBUG] === 출석 상태 업데이트 오류 ===');
      console.error('❌ [DEBUG] 오류:', error);
      console.error('❌ [DEBUG] 오류 타입:', typeof error);
      console.error('❌ [DEBUG] 오류 메시지:', (error as any)?.message);
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('❌ [DEBUG] HTTP 상태:', axiosError.response?.status);
        console.error('❌ [DEBUG] 응답 데이터:', axiosError.response?.data);
        console.error('❌ [DEBUG] 요청 URL:', axiosError.config?.url);
        console.error('❌ [DEBUG] 요청 메서드:', axiosError.config?.method);
        console.error('❌ [DEBUG] 요청 데이터:', axiosError.config?.data);
      }
      
      // 오류 시 원래 상태로 복원
      setAttendanceStates(prev => {
        const restored = { ...prev };
        delete restored[`${clinicId}-${studentId}`];
        console.log('🔄 [DEBUG] 상태 복원 완료. 복원된 상태:', restored);
        return restored;
      });
      
      toast({
        title: '출석 상태 업데이트 실패',
        description: '출석 상태 업데이트 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // console.log('🚀 [TodayClinicPage] === 페이지 진입 시작 ===');
        // console.log('🔍 [TodayClinicPage] 데이터 로드 시작');
        // console.log('📅 [TodayClinicPage] 오늘 요일:', today, `(${dayDisplay})`);

        // 클리닉과 학생 데이터를 병렬로 로드
        const [clinicsData, studentsData] = await Promise.all([
          getClinics(), // 모든 클리닉 데이터
          getStudents() // 학생 데이터만
        ]);

        setClinics(clinicsData);
        setStudents(studentsData);

        // === 디버깅 로그: 해당 요일 클리닉 정보 ===
        const todayClinicsData = clinicsData.filter((clinic: Clinic) => clinic.clinic_day === today) as Clinic[];
        // console.log('🏥 [TodayClinicPage] === 오늘 클리닉 정보 ===');
        // console.log(`📊 [TodayClinicPage] 전체 클리닉 수: ${clinicsData.length}개`);
        // console.log(`🎯 [TodayClinicPage] 오늘(${dayDisplay}) 클리닉 수: ${todayClinicsData.length}개`);
        
        if (todayClinicsData.length === 0) {
          // console.log('⚠️ [TodayClinicPage] 오늘 등록된 클리닉이 없습니다.');
        } else {
          // 시간별로 정렬하여 출력
          const sortedClinics = todayClinicsData.sort((a: Clinic, b: Clinic) => a.clinic_time.localeCompare(b.clinic_time));
          
          // console.log('📋 [TodayClinicPage] === 시간별 클리닉 상세 정보 ===');
          for (const clinic of sortedClinics) {
            const subject_kr = getKoreanSubjectName(clinic.clinic_subject);
            const teacher_name = (clinic.clinic_teacher as any)?.name || '강사 없음';
            const student_count = clinic.clinic_students?.length || 0;
            
            // console.log(`⏰ [${clinic.clinic_time}] ${subject_kr} - ${clinic.clinic_room}`);
            // console.log(`   👨‍🏫 강사: ${teacher_name}`);
            // console.log(`   👥 예약 학생: ${student_count}/${clinic.clinic_capacity}명`);
            // console.log(`   🔄 활성화: ${(clinic as any).is_active ? '활성' : '비활성'}`);
            // console.log(`   📍 클리닉 ID: ${clinic.id}`);
            
            // === 디버깅 로그: 클리닉별 학생 정보 ===
            if (student_count > 0) {
              // console.log(`   📚 [${clinic.clinic_time}] 예약 학생 목록:`);
              clinic.clinic_students.forEach((student: any, index: number) => {
                // console.log(`      ${index + 1}. ${student.name} (${student.username}) - ${student.school} ${student.grade}`);
                // console.log(`         📞 학생: ${student.student_phone_num || '없음'}, 학부모: ${student.student_parent_phone_num || '없음'}`);
                // console.log(`         ❌ 무단결석: ${student.no_show || 0}회`);
              });
            } else {
              // console.log(`   📚 [${clinic.clinic_time}] 예약 학생 없음`);
            }
            // console.log(''); // 빈 줄로 구분
          }
        }

        // === 디버깅 로그: 출석 데이터 로드 및 분석 ===
        // console.log('📋 [TodayClinicPage] === 출석 데이터 로드 시작 ===');
        let totalAttendanceRecords = 0;
        let clinicsWithAttendance = 0;
        let clinicsNeedingAttendance = 0;
        
        for (const clinic of todayClinicsData) {
            // 각 클리닉별로 출석 데이터 처리
            if (clinic.clinic_students && clinic.clinic_students.length > 0) {
              // 예약된 학생이 있는 클리닉만 출석 데이터 조회
              const existingAttendances = await getClinicAttendances(clinic.id);
              const attendanceCount = existingAttendances.length;
              
              if (attendanceCount === 0) {
                // 예약된 학생이 있지만 출석 데이터가 없는 경우 (이론적으로는 발생하지 않아야 함)
                // console.log(`⚠️ [경고] ${clinic.clinic_time} 클리닉: 예약된 학생이 있지만 출석 데이터가 없습니다.`);
                
                // 그냥 기존 로직대로 진행 (출석 데이터 로드)
                await loadAttendanceData(clinic);
                
              } else {
                // 기존 출석 데이터가 있는 경우 (정상적인 경우)
                await loadAttendanceData(clinic);
                totalAttendanceRecords += attendanceCount;
                clinicsWithAttendance++;
                
                // console.log(`✅ [출석데이터] ${clinic.clinic_time} 클리닉: ${attendanceCount}개 출석 기록 발견 (예약과 함께 자동 생성됨)`);
                
                // 출석 상태별 통계
                const attendanceStats = existingAttendances.reduce((stats: any, att: any) => {
                  stats[att.attendance_type] = (stats[att.attendance_type] || 0) + 1;
                  return stats;
                }, {});
                
                // console.log(`   📊 [출석통계] none: ${attendanceStats.none || 0}, attended: ${attendanceStats.attended || 0}, absent: ${attendanceStats.absent || 0}, late: ${attendanceStats.late || 0}, sick: ${attendanceStats.sick || 0}`);
              }
              
            } else {
              // 예약된 학생이 없는 클리닉 - 출석 데이터 처리 건너뜀
              // console.log(`⏭️ [출석데이터] ${clinic.clinic_time} 클리닉: 예약 학생 없음, 출석 데이터 처리 건너뜀`);
            }
        }

        // === 디버깅 로그: 전체 요약 ===
        // console.log('📈 [TodayClinicPage] === 전체 데이터 로드 요약 ===');
        // console.log(`🏥 총 클리닉: ${clinicsData.length}개 (오늘: ${todayClinicsData.length}개)`);
        // console.log(`👥 총 학생: ${studentsData.length}명`);
        // console.log(`📋 총 출석 기록: ${totalAttendanceRecords}개`);
        // console.log(`✅ 출석 데이터가 있는 클리닉: ${clinicsWithAttendance}/${todayClinicsData.length}개`);
        // console.log(`🔧 자동 생성이 필요했던 클리닉: ${clinicsNeedingAttendance}개`);
        
        // console.log('✅ [TodayClinicPage] 데이터 로드 완료:', {
          // clinics: clinicsData.length,
          // students: studentsData.length,
          // todayClinics: todayClinicsData.length,
          // attendanceRecords: totalAttendanceRecords,
          // autoCreatedClinics: clinicsNeedingAttendance,
          // today
        // });

        // console.log('🏁 [TodayClinicPage] === 페이지 진입 완료 ===');

      } catch (error) {
        // console.error('❌ [TodayClinicPage] 데이터 로드 오류:', error);
        
        toast({
          title: '데이터 로드 실패',
          description: '클리닉 정보를 불러오는 중 오류가 발생했습니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [toast, today]);

  // 시간대별 클리닉 정보를 렌더링하는 함수
  const renderClinicTimeTab = (clinic: Clinic | undefined, timeSlot: string) => {
    if (!clinic) {
      return (
        <Box textAlign="center" py={8} color="gray.500">
          <Text>🕐</Text>
          <Text mt={2}>{timeSlot} 시간대에 등록된 클리닉이 없습니다.</Text>
          <Text fontSize="sm" color="gray.400" mt={1}>
            관리자가 해당 시간대 클리닉을 생성해야 합니다.
          </Text>
        </Box>
      );
    }

    const currentStudentCount = clinic.clinic_students?.length || 0;
    const remainingCapacity = clinic.clinic_capacity - currentStudentCount;

    return (
      <VStack align="stretch" spacing={4}>
        {/* 클리닉 기본 정보 카드 */}
        <Card>
          <CardHeader pb={2}>
            <Flex justify="space-between" align="center">
              <Heading size="sm">클리닉 정보</Heading>
              {/* 자동 생성 상태 표시 */}
              <Text fontSize="xs" color="gray.500">
                출석 데이터 자동 생성됨
              </Text>
            </Flex>
          </CardHeader>
          <CardBody pt={0}>
            <HStack spacing={4} flexWrap="wrap">
              {/* <Badge colorScheme="blue" size="md">
                {getKoreanSubjectName(clinic.clinic_subject)}
              </Badge> */}
              {/* <Badge colorScheme="green" size="md">
                {(clinic.clinic_teacher as any)?.name || clinic.teacher_name || '강사 없음'}
              </Badge> */}
              <Badge colorScheme="purple" size="md">
                {clinic.clinic_room}
              </Badge>
              <Badge 
                colorScheme={remainingCapacity <= 0 ? 'red' : 'gray'} 
                size="md"
              >
                {currentStudentCount}/{clinic.clinic_capacity}명
              </Badge>
            </HStack>
          </CardBody>
        </Card>

        {/* 신청한 학생 목록 및 출석 체크 */}
        <Card>
          <CardHeader pb={2}>
            <Flex justify="space-between" align="center">
              <Heading size="sm">학생 목록 및 출석 체크</Heading>
              <Text fontSize="sm" color="gray.600">
                총 {currentStudentCount}명
              </Text>
            </Flex>
          </CardHeader>
          <CardBody pt={0}>
            {currentStudentCount === 0 ? (
              <Box textAlign="center" py={8} color="gray.500">
                <Text>아직 신청한 학생이 없습니다.</Text>
              </Box>
            ) : (
              <TableContainer>
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>번호</Th>
                      <Th>학생 이름</Th>
                      <Th>학교/학년</Th>
                      <Th>학부모님 전화번호</Th>
                      <Th>학생 전화번호</Th>
                      <Th width="320px">출석 상태</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {clinic.clinic_students.map((student, index) => {
                      const stateKey = `${clinic.id}-${student.id}`;
                      const currentAttendance = attendanceStates[stateKey] || 'none';
                      
                      return (
                        <Tr key={`student-${student.id}-${index}-${timeSlot}`}>
                          <Td>{index + 1}</Td>
                          <Td fontWeight="semibold">
                            {student.name || student.username || '이름 없음'}
                          </Td>
                          <Td>
                            <Text fontSize="sm">
                              {student.school} {student.grade}
                            </Text>
                          </Td>
                          <Td>{student.student_parent_phone_num || '-'}</Td>
                          <Td>{student.student_phone_num || '-'}</Td>
                          <Td>
                            {/* 토글 형식의 출석 체크 버튼들 - space-between으로 균등 분포 */}
                            <Flex justify="space-between" align="center" width="100%">
                              {ATTENDANCE_OPTIONS.map((option) => (
                                <Button
                                  key={option.value}
                                  size="sm"
                                  colorScheme={option.color}
                                  variant={currentAttendance === option.value ? 'solid' : 'outline'}
                                  onClick={() => handleAttendanceChange(clinic.id, student.id, option.value)}
                                  flex="1"
                                  mx={1}
                                  fontSize="xs"
                                  minW="50px"
                                  h="28px"
                                  border="1px solid"
                                  borderColor={
                                    currentAttendance === option.value 
                                      ? `${option.color}.500` 
                                      : `${option.color}.500`
                                  }
                                  _hover={{
                                    transform: 'none', // hover 시 변형 방지
                                    borderColor: `${option.color}.600`
                                  }}
                                  _active={{
                                    transform: 'none' // active 시 변형 방지
                                  }}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </Flex>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </CardBody>
        </Card>
      </VStack>
    );
  };

  // 로딩 상태 렌더링
  if (isLoading) {
    return (
      <Center minH="50vh">
        <VStack spacing={4}>
          <Spinner size="lg" color="blue.500" />
          <Text color="gray.600">오늘의 클리닉 정보를 불러오는 중...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box maxW="7xl" mx="auto" px={6} py={4}>
      <VStack align="stretch" spacing={6}>
        {/* 페이지 헤더 */}
        <Card>
          <CardHeader>
            <VStack align="stretch" spacing={3}>
              {/* 제목 */}
              <Flex justify="space-between" align="center">
                <Heading size="lg" color="blue.600">
                  {dayDisplay} 보충
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  {new Date().toLocaleDateString('ko-KR')}
                </Text>
              </Flex>
              
              {/* 전체 통계 정보 */}
              <HStack spacing={2} flexWrap="wrap">
                {TIME_SLOTS.map(timeSlot => {
                  const clinic = todayClinics.find(c => c?.clinic_time === timeSlot);
                  const count = clinic?.clinic_students?.length || 0;
                  const capacity = clinic?.clinic_capacity || 0;
                  
                  return (
                    <Badge 
                      key={timeSlot}
                      colorScheme={clinic ? (count >= capacity ? 'red' : 'blue') : 'gray'}
                      size="md"
                    >
                      {timeSlot}: {count}/{capacity}명
                    </Badge>
                  );
                })}
              </HStack>
            </VStack>
          </CardHeader>
        </Card>

        {/* 시간대별 클리닉 탭 */}
        <Card>
          <CardBody>
            <Tabs 
              index={selectedTabIndex} 
              onChange={setSelectedTabIndex} 
              variant="enclosed"
              colorScheme="blue"
            >
              {/* 시간대별 탭 헤더 */}
              <TabList>
                {TIME_SLOTS.map((timeSlot, index) => {
                  const clinic = todayClinics[index];
                  const count = clinic?.clinic_students?.length || 0;
                  const isActive = clinic !== undefined;
                  
                  return (
                    <Tab 
                      key={timeSlot}
                      _selected={{ 
                        color: isActive ? 'blue.600' : 'gray.600',
                        borderColor: isActive ? 'blue.500' : 'gray.400'
                      }}
                      color={isActive ? 'blue.500' : 'gray.400'}
                    >
                      <VStack spacing={1}>
                        <Text fontSize="md" fontWeight="bold">
                          {timeSlot}
                        </Text>
                        <Badge 
                          size="sm" 
                          colorScheme={isActive ? (count > 0 ? 'blue' : 'gray') : 'red'}
                        >
                          {isActive ? `${count}명` : '없음'}
                        </Badge>
                      </VStack>
                    </Tab>
                  );
                })}
              </TabList>

              {/* 시간대별 탭 내용 */}
              <TabPanels>
                {TIME_SLOTS.map((timeSlot, index) => (
                  <TabPanel key={timeSlot} px={0} py={6}>
                    {renderClinicTimeTab(todayClinics[index], timeSlot)}
                  </TabPanel>
                ))}
              </TabPanels>
            </Tabs>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
};

// AuthGuard로 감싸서 관리자와 강사만 접근 가능
const TodayClinicPage: React.FC = () => {
  return (
    <AuthGuard allowedRoles={['admin', 'teacher']} requireAuth={true}>
      <TodayClinicPageContent />
    </AuthGuard>
  );
};

export default TodayClinicPage; 