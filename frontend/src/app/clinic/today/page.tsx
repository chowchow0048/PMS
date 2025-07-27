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
  Button
} from '@chakra-ui/react';
import { InfoIcon } from '@chakra-ui/icons';
import { Clinic, User, DAY_CHOICES } from '@/lib/types';
import { getClinics, getStudents } from '@/lib/api';

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

/**
 * 오늘의 클리닉 페이지 컴포넌트
 * 오늘 요일에 해당하는 클리닉들의 출석 관리를 위한 페이지
 */
const TodayClinicPage: React.FC = () => {
  const toast = useToast();
  const [clinics, setClinics] = useState<Clinic[]>([]); // 모든 클리닉 데이터
  const [students, setStudents] = useState<User[]>([]); // 모든 학생 데이터
  const [isLoading, setIsLoading] = useState(true); // 로딩 상태
  const [selectedTabIndex, setSelectedTabIndex] = useState(0); // 선택된 탭 인덱스
  
  const today = getTodayDay(); // 오늘 요일
  const dayDisplay = DAY_CHOICES.find(d => d.value === today)?.label || today; // 요일 한글 표시

  // 오늘 요일의 시간대별 클리닉 찾기
  const todayClinics = TIME_SLOTS.map(timeSlot => 
    clinics.find(clinic => clinic.clinic_day === today && clinic.clinic_time === timeSlot)
  );

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        console.log('🔍 [TodayClinicPage] 데이터 로드 시작');

        // 클리닉과 학생 데이터를 병렬로 로드
        const [clinicsData, studentsData] = await Promise.all([
          getClinics(), // 모든 클리닉 데이터
          getStudents() // 학생 데이터만
        ]);

        setClinics(clinicsData);
        setStudents(studentsData);

        console.log('✅ [TodayClinicPage] 데이터 로드 완료:', {
          clinics: clinicsData.length,
          students: studentsData.length,
          today
        });

      } catch (error) {
        console.error('❌ [TodayClinicPage] 데이터 로드 오류:', error);
        
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
        {/* 클리닉 기본 정보 */}
        <Card>
          <CardHeader pb={2}>
            <Heading size="sm">클리닉 정보</Heading>
          </CardHeader>
          <CardBody pt={0}>
                         <HStack spacing={4} flexWrap="wrap">
               <Badge colorScheme="blue" size="md">
                 {(clinic.clinic_subject as any)?.subject || clinic.subject_name || '과목 없음'}
               </Badge>
               <Badge colorScheme="green" size="md">
                 {(clinic.clinic_teacher as any)?.name || clinic.teacher_name || '강사 없음'}
               </Badge>
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
                      <Th width="200px">출석 상태</Th>
                      <Th width="100px">관리</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {clinic.clinic_students.map((student, index) => (
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
                          {/* 출석 체크 버튼들 - 추후 구현 */}
                          <HStack spacing={1}>
                            <Button size="xs" colorScheme="green" variant="outline">
                              출석
                            </Button>
                            <Button size="xs" colorScheme="red" variant="outline">
                              결석
                            </Button>
                            <Button size="xs" colorScheme="yellow" variant="outline">
                              지각
                            </Button>
                            <Button size="xs" colorScheme="blue" variant="outline">
                              병결
                            </Button>
                          </HStack>
                        </Td>
                        <Td>
                          <IconButton
                            aria-label="학생 정보"
                            icon={<InfoIcon />}
                            size="sm"
                            colorScheme="blue"
                            variant="ghost"
                          />
                        </Td>
                      </Tr>
                    ))}
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
    <Box maxW="7xl" mx="auto" px={6} py={8}>
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
              <HStack spacing={4} flexWrap="wrap">
                {/* <Text fontSize="sm" color="gray.600">
                  
                </Text> */}
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

export default TodayClinicPage; 