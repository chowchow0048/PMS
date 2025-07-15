'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  SimpleGrid,
  Spinner,
  Center,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Card,
  CardHeader,
  CardBody,
  useToast,
  Divider,
  Flex,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  ButtonGroup,
  Tooltip,
} from '@chakra-ui/react';
import { getTodayClinic, updateClinic } from '@/lib/api';
import { Student } from '@/components/student-placement/StudentItem';
import { Clinic } from '@/lib/types';
import { ArrowBackIcon, EditIcon, ViewIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/navigation';

// 보기 모드 타입 정의
type ViewMode = 'box' | 'table';

// 학생 정렬 함수
const sortStudents = (students: Student[]): Student[] => {
  return [...students].sort((a, b) => {
    // 먼저 학교별로 정렬 (세화고 먼저)
    const schoolA = a.school || '';
    const schoolB = b.school || '';
    
    // 세화고 우선순위 체크
    const isSchoolASehwa = schoolA.includes('세화고') || schoolA.includes('세화');
    const isSchoolBSehwa = schoolB.includes('세화고') || schoolB.includes('세화');
    
    if (isSchoolASehwa && !isSchoolBSehwa) {
      return -1;
    }
    if (!isSchoolASehwa && isSchoolBSehwa) {
      return 1;
    }
    
    // 같은 학교이거나 둘 다 세화고가 아닌 경우, 학교 이름으로 정렬
    if (schoolA !== schoolB) {
      return schoolA.localeCompare(schoolB, 'ko');
    }
    
    // 같은 학교 내에서는 학생 이름으로 내림차순 정렬
    const nameA = a.student_name || '';
    const nameB = b.student_name || '';
    return nameB.localeCompare(nameA, 'ko');
  });
};

// 학생 박스 컴포넌트
const StudentBox: React.FC<{
  student: Student;
  isPrime?: boolean;
  isSub?: boolean;
  // onTogglePrime?: () => void;  // 주석처리
  // onToggleSub?: () => void;    // 주석처리
  // isUpdating?: boolean;        // 주석처리
  isAttended?: boolean;
  onToggleAttendance?: () => void;
  isUpdating?: boolean;
}> = ({ 
  student, 
  isPrime, 
  isSub, 
  // onTogglePrime,      // 주석처리
  // onToggleSub,        // 주석처리
  isAttended = false,
  onToggleAttendance,
  isUpdating = false
}) => {
  return (
    <Card
      size="sm"
      variant="outline"
      bg="white"
      _hover={{ borderColor: 'blue.300' }}
      transition="all 0.2s"
      minH="140px"
      cursor="pointer"
    >
      <CardBody display="flex" flexDirection="column" justifyContent="space-between">
        {/* 학생 정보 */}
        <VStack align="start" spacing={1} flex="1">
          <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
            {student.student_name}
          </Text>
          <Text fontSize="xs" color="gray.600" noOfLines={1}>
            {student.student_phone_num}
          </Text>
          <Text fontSize="xs" color="gray.600" noOfLines={1}>
            {student.school} {student.grade}
          </Text>
        </VStack>

        {/* 출석 체크 버튼 */}
        <VStack spacing={1} mt={2}>
          <Button
            size="sm"
            colorScheme={isAttended ? 'green' : 'gray'}
            variant={isAttended ? 'solid' : 'outline'}
            onClick={onToggleAttendance}
            isLoading={isUpdating}
            width="100%"
            fontSize="xs"
          >
            {isAttended ? '출석 완료' : '출석 체크'}
          </Button>
        </VStack>
      </CardBody>
    </Card>
  );
};

// 학생 테이블 행 컴포넌트 (출석 전용)
const StudentTableRow: React.FC<{
  student: Student;
  isPrime: boolean;
  isSub: boolean;
  isAttended: boolean;
  onToggleAttendance: () => void;
  isUpdating: boolean;
}> = ({ student, isPrime, isSub, isAttended, onToggleAttendance, isUpdating }) => {
  return (
    <Tr>
      <Td border="1px solid" borderColor="gray.200">{student.school}</Td>
      <Td border="1px solid" borderColor="gray.200">{student.grade}</Td>
      <Td border="1px solid" borderColor="gray.200" fontWeight="semibold">{student.student_name}</Td>
      <Td border="1px solid" borderColor="gray.200">{student.student_phone_num}</Td>
      <Td border="1px solid" borderColor="gray.200">{student.student_parent_phone_num}</Td>
      <Td border="1px solid" borderColor="gray.200" textAlign="center">
        <Badge colorScheme={isPrime ? 'blue' : 'gray'}>
          {isPrime ? '등록' : '미등록'}
        </Badge>
      </Td>
      <Td border="1px solid" borderColor="gray.200" textAlign="center">
        <Badge colorScheme={isSub ? 'green' : 'gray'}>
          {isSub ? '등록' : '미등록'}
        </Badge>
      </Td>
      <Td border="1px solid" borderColor="gray.200" textAlign="center">
        <Button
          size="xs"
          bg={isAttended ? 'green.500' : 'gray.400'}
          color="white"
          _hover={{ bg: isAttended ? 'green.600' : 'gray.500' }}
          onClick={onToggleAttendance}
          isLoading={isUpdating}
          width="80px"
        >
          {isAttended ? '출석완료' : '출석체크'}
        </Button>
      </Td>
    </Tr>
  );
};

// 클리닉 카드 컴포넌트
const ClinicCard: React.FC<{
  clinic: Clinic;
  students: Student[];
  onStudentUpdate: (clinic: Clinic) => void;
}> = ({ clinic, students, onStudentUpdate }) => {
  const [updatingStudents, setUpdatingStudents] = useState<Set<number>>(new Set());
  const [localClinic, setLocalClinic] = useState<Clinic>(clinic);
  const [attendedStudents, setAttendedStudents] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('box');
  const toast = useToast();
  
  useEffect(() => {
    setLocalClinic(clinic);
  }, [clinic]);

  // 학생의 현재 상태 확인
  const isStudentInPrime = (studentId: number): boolean => {
    return localClinic?.clinic_prime_students?.includes(studentId) || false;
  };

  const isStudentInSub = (studentId: number): boolean => {
    return localClinic?.clinic_sub_students?.includes(studentId) || false;
  };

  // 해당 클리닉에 배치된 학생들만 필터링
  const getClinicStudents = (): Student[] => {
    const clinicStudentIds = [
      ...(localClinic.clinic_prime_students || []),
      ...(localClinic.clinic_sub_students || []),
      ...(localClinic.clinic_unassigned_students || [])
    ];
    
    const uniqueStudentIds = Array.from(new Set(clinicStudentIds));
    const clinicStudents = students.filter(student => uniqueStudentIds.includes(student.id));
    return sortStudents(clinicStudents);
  };

  // 해설 클리닉 학생들 필터링
  const getPrimeStudents = (): Student[] => {
    const primeStudentIds = localClinic.clinic_prime_students || [];
    const primeStudents = students.filter(student => primeStudentIds.includes(student.id));
    return sortStudents(primeStudents);
  };

  // 질문 클리닉 학생들 필터링
  const getSubStudents = (): Student[] => {
    const subStudentIds = localClinic.clinic_sub_students || [];
    const subStudents = students.filter(student => subStudentIds.includes(student.id));
    return sortStudents(subStudents);
  };

  // 출석 체크 토글 처리
  const handleToggleAttendance = async (studentId: number) => {
    setUpdatingStudents(prev => new Set(prev).add(studentId));

    try {
      const isCurrentlyAttended = attendedStudents.has(studentId);
      
      if (isCurrentlyAttended) {
        setAttendedStudents(prev => {
          const newSet = new Set(prev);
          newSet.delete(studentId);
          return newSet;
        });
        toast({
          title: '출석 취소',
          description: '출석이 취소되었습니다.',
          status: 'warning',
          duration: 1000,
          isClosable: true,
        });
      } else {
        setAttendedStudents(prev => new Set(prev).add(studentId));
        toast({
          title: '출석 체크 완료',
          description: '출석이 완료되었습니다.',
          status: 'success',
          duration: 1000,
          isClosable: true,
        });
      }

    } catch (error) {
      console.error('출석 체크 실패:', error);
      toast({
        title: '출석 체크 실패',
        description: '다시 시도해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setUpdatingStudents(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  // 일괄 출석 처리
  const handleBulkAttendance = async (students: Student[], sectionName: string) => {
    try {
      const studentIds = students.map(student => student.id);
      setUpdatingStudents(prev => {
        const newSet = new Set(prev);
        studentIds.forEach(id => newSet.add(id));
        return newSet;
      });

      // 모든 학생을 출석으로 표시
      setAttendedStudents(prev => {
        const newSet = new Set(prev);
        studentIds.forEach(id => newSet.add(id));
        return newSet;
      });

      toast({
        title: '일괄 출석 완료',
        description: `${sectionName} ${students.length}명의 출석이 완료되었습니다.`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });

    } catch (error) {
      console.error('일괄 출석 실패:', error);
      toast({
        title: '일괄 출석 실패',
        description: '다시 시도해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      // 업데이트 상태 해제
      setTimeout(() => {
        setUpdatingStudents(prev => {
          const newSet = new Set(prev);
          students.forEach(student => newSet.delete(student.id));
          return newSet;
        });
      }, 500);
    }
  };

  // 이전 토글 처리 로직 (주석처리)
  // const handleToggleStudent = async (studentId: number, section: 'prime' | 'sub') => {
  //   setUpdatingStudents(prev => new Set(prev).add(studentId));

  //   try {
  //     const currentPrimeStudents = [...(localClinic.clinic_prime_students || [])];
  //     const currentSubStudents = [...(localClinic.clinic_sub_students || [])];
  //     const currentUnassignedStudents = [...(localClinic.clinic_unassigned_students || [])];
      
  //     const isPrimeNow = currentPrimeStudents.includes(studentId);
  //     const isSubNow = currentSubStudents.includes(studentId);
      
  //     let newPrimeState = isPrimeNow;
  //     let newSubState = isSubNow;
      
  //     if (section === 'prime') {
  //       newPrimeState = !isPrimeNow;
  //     } else {
  //       newSubState = !isSubNow;
  //     }

  //     let newPrimeStudents = currentPrimeStudents.filter(id => id !== studentId);
  //     let newSubStudents = currentSubStudents.filter(id => id !== studentId);
  //     let newUnassignedStudents = currentUnassignedStudents.filter(id => id !== studentId);

  //     if (newPrimeState && newSubState) {
  //       newPrimeStudents.push(studentId);
  //       newSubStudents.push(studentId);
  //     } else if (newPrimeState && !newSubState) {
  //       newPrimeStudents.push(studentId);
  //     } else if (!newPrimeState && newSubState) {
  //       newSubStudents.push(studentId);
  //     } else {
  //       newUnassignedStudents.push(studentId);
  //     }

  //     const updatedClinic = {
  //       ...localClinic,
  //       clinic_prime_students: newPrimeStudents,
  //       clinic_sub_students: newSubStudents,
  //       clinic_unassigned_students: newUnassignedStudents,
  //     };

  //     const savedClinic = await updateClinic(localClinic.id, updatedClinic);
  //     setLocalClinic(savedClinic);
  //     onStudentUpdate(savedClinic);

  //     toast({
  //       title: '업데이트 완료',
  //       status: 'success',
  //       duration: 1000,
  //       isClosable: true,
  //     });

  //   } catch (error) {
  //     console.error('클리닉 업데이트 실패:', error);
  //     toast({
  //       title: '업데이트 실패',
  //       description: '다시 시도해주세요.',
  //       status: 'error',
  //       duration: 3000,
  //       isClosable: true,
  //     });
  //   } finally {
  //     setUpdatingStudents(prev => {
  //       const newSet = new Set(prev);
  //       newSet.delete(studentId);
  //       return newSet;
  //     });
  //   }
  // };

  const clinicStudents = getClinicStudents();
  const primeStudents = getPrimeStudents();
  const subStudents = getSubStudents();

  return (
    <Card variant="outline" bg="white">
      <CardHeader>
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <HStack spacing={3}>
              <Badge colorScheme="blue" fontSize="sm">
                {localClinic.clinic_day === 'mon' ? '월요일' :
                 localClinic.clinic_day === 'tue' ? '화요일' :
                 localClinic.clinic_day === 'wed' ? '수요일' :
                 localClinic.clinic_day === 'thu' ? '목요일' :
                 localClinic.clinic_day === 'fri' ? '금요일' : ''}
              </Badge>
              <Text fontSize="lg" fontWeight="bold">
                {localClinic.teacher_name} 선생님
              </Text>
            </HStack>
            <HStack spacing={4}>
              <HStack>
                <Badge colorScheme="blue">해설</Badge>
                <Text fontSize="sm">
                  {localClinic.clinic_prime_students?.length || 0}명
                </Text>
              </HStack>
              <HStack>
                <Badge colorScheme="green">질문</Badge>
                <Text fontSize="sm">
                  {localClinic.clinic_sub_students?.length || 0}명
                </Text>
              </HStack>
              <HStack>
                <Badge colorScheme="orange">미배치</Badge>
                <Text fontSize="sm">
                  {localClinic.clinic_unassigned_students?.length || 0}명
                </Text>
              </HStack>
              <HStack>
                <Badge colorScheme="gray">총 등록</Badge>
                <Text fontSize="sm">
                  {clinicStudents.length}명
                </Text>
              </HStack>
            </HStack>
          </VStack>
          
          {/* 보기 모드 전환 버튼 */}
          <ButtonGroup isAttached>
            <Button
              leftIcon={<ViewIcon />}
              size="sm"
              colorScheme={viewMode === 'box' ? 'blue' : 'gray'}
              variant={viewMode === 'box' ? 'solid' : 'outline'}
              onClick={() => setViewMode('box')}
            >
              박스 형식
            </Button>
            <Button
              leftIcon={<EditIcon />}
              size="sm"
              colorScheme={viewMode === 'table' ? 'blue' : 'gray'}
              variant={viewMode === 'table' ? 'solid' : 'outline'}
              onClick={() => setViewMode('table')}
            >
              표 형식
            </Button>
          </ButtonGroup>
        </HStack>
      </CardHeader>
      
      <CardBody pt={0}>
        <Divider mb={4} />
        
        {clinicStudents.length === 0 ? (
          <Center py={8}>
            <Text color="gray.500">
              이 클리닉에 등록된 학생이 없습니다.
            </Text>
          </Center>
        ) : viewMode === 'box' ? (
          <VStack spacing={6} align="stretch">
            {/* 해설 클리닉과 질문 클리닉을 가로로 50%씩 배치 */}
            <HStack spacing={4} align="stretch">
              {/* 해설 클리닉 학생들 - 왼쪽 50% */}
              <Box width="50%">
                <HStack spacing={2} mb={3} justify="space-between" align="center">
                  <HStack spacing={2}>
                    <Badge colorScheme="blue" size="md">
                      숙제 해설 클리닉
                    </Badge>
                    <Text fontSize="sm" color="gray.600">
                      {primeStudents.length}명
                    </Text>
                  </HStack>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    variant="outline"
                    onClick={() => handleBulkAttendance(primeStudents, '해설 클리닉')}
                    isDisabled={primeStudents.every(student => attendedStudents.has(student.id))}
                  >
                    일괄출석
                  </Button>
                </HStack>
                {primeStudents.length > 0 ? (
                  <SimpleGrid columns={[1, 2, 3]} spacing={3}>
                    {primeStudents.map(student => (
                      <StudentBox
                        key={`prime-${student.id}`}
                        student={student}
                        isPrime={true}
                        isSub={isStudentInSub(student.id)}
                        isAttended={attendedStudents.has(student.id)}
                        onToggleAttendance={() => handleToggleAttendance(student.id)}
                        isUpdating={updatingStudents.has(student.id)}
                      />
                    ))}
                  </SimpleGrid>
                ) : (
                  <Center py={8}>
                    <Text color="gray.400" fontSize="sm">
                      해설 클리닉에 등록된 학생이 없습니다.
                    </Text>
                  </Center>
                )}
              </Box>

              {/* 질문 클리닉 학생들 - 오른쪽 50% */}
              <Box width="50%">
                <HStack spacing={2} mb={3} justify="space-between" align="center">
                  <HStack spacing={2}>
                    <Badge colorScheme="green" size="md">
                      자유 질문 클리닉
                    </Badge>
                    <Text fontSize="sm" color="gray.600">
                      {subStudents.length}명
                    </Text>
                  </HStack>
                  <Button
                    size="sm"
                    colorScheme="green"
                    variant="outline"
                    onClick={() => handleBulkAttendance(subStudents, '질문 클리닉')}
                    isDisabled={subStudents.every(student => attendedStudents.has(student.id))}
                  >
                    일괄출석
                  </Button>
                </HStack>
                {subStudents.length > 0 ? (
                  <SimpleGrid columns={[1, 2, 3]} spacing={3}>
                    {subStudents.map(student => (
                      <StudentBox
                        key={`sub-${student.id}`}
                        student={student}
                        isPrime={isStudentInPrime(student.id)}
                        isSub={true}
                        isAttended={attendedStudents.has(student.id)}
                        onToggleAttendance={() => handleToggleAttendance(student.id)}
                        isUpdating={updatingStudents.has(student.id)}
                      />
                    ))}
                  </SimpleGrid>
                ) : (
                  <Center py={8}>
                    <Text color="gray.400" fontSize="sm">
                      질문 클리닉에 등록된 학생이 없습니다.
                    </Text>
                  </Center>
                )}
              </Box>
            </HStack>

            {/* 둘 다 등록하지 않은 학생들이 있을 경우 */}
            {clinicStudents.length > 0 && primeStudents.length === 0 && subStudents.length === 0 && (
              <Box>
                <HStack spacing={2} mb={3}>
                  <Badge colorScheme="orange" size="md">
                    미배치 학생
                  </Badge>
                  <Text fontSize="sm" color="gray.600">
                    {clinicStudents.filter(student => 
                      !isStudentInPrime(student.id) && !isStudentInSub(student.id)
                    ).length}명
                  </Text>
                </HStack>
                <SimpleGrid columns={[2, 3, 4, 5, 6]} spacing={3}>
                  {clinicStudents
                    .filter(student => !isStudentInPrime(student.id) && !isStudentInSub(student.id))
                    .map(student => (
                      <StudentBox
                        key={`unassigned-${student.id}`}
                        student={student}
                        isPrime={false}
                        isSub={false}
                        isAttended={attendedStudents.has(student.id)}
                        onToggleAttendance={() => handleToggleAttendance(student.id)}
                        isUpdating={updatingStudents.has(student.id)}
                      />
                    ))}
                </SimpleGrid>
              </Box>
            )}
          </VStack>
        ) : (
          // 표 형식 보기 - 해설/질문 클리닉 분리
          <VStack spacing={6} align="stretch">
            {/* 해설 클리닉 테이블 */}
            {primeStudents.length > 0 && (
              <Box>
                <HStack spacing={2} mb={3} justify="space-between" align="center">
                  <HStack spacing={2}>
                    <Badge colorScheme="blue" size="md">
                      숙제 해설 클리닉
                    </Badge>
                    <Text fontSize="sm" color="gray.600">
                      {primeStudents.length}명
                    </Text>
                  </HStack>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    variant="outline"
                    onClick={() => handleBulkAttendance(primeStudents, '해설 클리닉')}
                    isDisabled={primeStudents.every(student => attendedStudents.has(student.id))}
                  >
                    일괄출석
                  </Button>
                </HStack>
                
                <TableContainer border="1px solid" borderColor="gray.200" borderRadius="md">
                  <Table variant="simple" size="sm" style={{ borderCollapse: 'collapse' }}>
                    <Thead>
                      <Tr>
                        <Th border="1px solid" borderColor="gray.200">학교</Th>
                        <Th border="1px solid" borderColor="gray.200">학년</Th>
                        <Th border="1px solid" borderColor="gray.200">학생이름</Th>
                        <Th border="1px solid" borderColor="gray.200">학생번호</Th>
                        <Th border="1px solid" borderColor="gray.200">학부모번호</Th>
                        <Th border="1px solid" borderColor="gray.200" textAlign="center">해설</Th>
                        <Th border="1px solid" borderColor="gray.200" textAlign="center">질문</Th>
                        <Th border="1px solid" borderColor="gray.200" textAlign="center">출석</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {primeStudents.map(student => (
                        <StudentTableRow
                          key={student.id}
                          student={student}
                          isPrime={isStudentInPrime(student.id)}
                          isSub={isStudentInSub(student.id)}
                          isAttended={attendedStudents.has(student.id)}
                          onToggleAttendance={() => handleToggleAttendance(student.id)}
                          isUpdating={updatingStudents.has(student.id)}
                        />
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* 질문 클리닉 테이블 */}
            {subStudents.length > 0 && (
              <Box>
                <HStack spacing={2} mb={3} justify="space-between" align="center">
                  <HStack spacing={2}>
                    <Badge colorScheme="green" size="md">
                      자유 질문 클리닉
                    </Badge>
                    <Text fontSize="sm" color="gray.600">
                      {subStudents.length}명
                    </Text>
                  </HStack>
                  <Button
                    size="sm"
                    colorScheme="green"
                    variant="outline"
                    onClick={() => handleBulkAttendance(subStudents, '질문 클리닉')}
                    isDisabled={subStudents.every(student => attendedStudents.has(student.id))}
                  >
                    일괄출석
                  </Button>
                </HStack>
                
                <TableContainer border="1px solid" borderColor="gray.200" borderRadius="md">
                  <Table variant="simple" size="sm" style={{ borderCollapse: 'collapse' }}>
                    <Thead>
                      <Tr>
                        <Th border="1px solid" borderColor="gray.200">학교</Th>
                        <Th border="1px solid" borderColor="gray.200">학년</Th>
                        <Th border="1px solid" borderColor="gray.200">학생이름</Th>
                        <Th border="1px solid" borderColor="gray.200">학생번호</Th>
                        <Th border="1px solid" borderColor="gray.200">학부모번호</Th>
                        <Th border="1px solid" borderColor="gray.200" textAlign="center">해설</Th>
                        <Th border="1px solid" borderColor="gray.200" textAlign="center">질문</Th>
                        <Th border="1px solid" borderColor="gray.200" textAlign="center">출석</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {subStudents.map(student => (
                        <StudentTableRow
                          key={student.id}
                          student={student}
                          isPrime={isStudentInPrime(student.id)}
                          isSub={isStudentInSub(student.id)}
                          isAttended={attendedStudents.has(student.id)}
                          onToggleAttendance={() => handleToggleAttendance(student.id)}
                          isUpdating={updatingStudents.has(student.id)}
                        />
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* 둘 다 등록하지 않은 학생들이 있을 경우 */}
            {clinicStudents.length > 0 && primeStudents.length === 0 && subStudents.length === 0 && (
              <Box>
                <HStack spacing={2} mb={3}>
                  <Badge colorScheme="orange" size="md">
                    미배치 학생
                  </Badge>
                  <Text fontSize="sm" color="gray.600">
                    {clinicStudents.filter(student => 
                      !isStudentInPrime(student.id) && !isStudentInSub(student.id)
                    ).length}명
                  </Text>
                </HStack>
                
                <TableContainer border="1px solid" borderColor="gray.200" borderRadius="md">
                  <Table variant="simple" size="sm" style={{ borderCollapse: 'collapse' }}>
                    <Thead>
                      <Tr>
                        <Th border="1px solid" borderColor="gray.200">학교</Th>
                        <Th border="1px solid" borderColor="gray.200">학년</Th>
                        <Th border="1px solid" borderColor="gray.200">학생이름</Th>
                        <Th border="1px solid" borderColor="gray.200">학생번호</Th>
                        <Th border="1px solid" borderColor="gray.200">학부모번호</Th>
                        <Th border="1px solid" borderColor="gray.200" textAlign="center">해설</Th>
                        <Th border="1px solid" borderColor="gray.200" textAlign="center">질문</Th>
                        <Th border="1px solid" borderColor="gray.200" textAlign="center">출석</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {clinicStudents
                        .filter(student => !isStudentInPrime(student.id) && !isStudentInSub(student.id))
                        .map(student => (
                          <StudentTableRow
                            key={student.id}
                            student={student}
                            isPrime={isStudentInPrime(student.id)}
                            isSub={isStudentInSub(student.id)}
                            isAttended={attendedStudents.has(student.id)}
                            onToggleAttendance={() => handleToggleAttendance(student.id)}
                            isUpdating={updatingStudents.has(student.id)}
                          />
                        ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
};

// 메인 페이지 컴포넌트
const TodayClinicPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTodayClinic();
      setData(response);
    } catch (err) {
      console.error('오늘의 클리닉 데이터 로드 실패:', err);
      setError('오늘의 클리닉 정보를 불러오는데 실패했습니다.');
      toast({
        title: '데이터 로드 실패',
        description: '오늘의 클리닉 정보를 불러오는데 실패했습니다.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 클리닉 업데이트 처리
  const handleClinicUpdate = (updatedClinic: Clinic) => {
    if (data) {
      const updatedClinics = data.clinics.map((clinic: Clinic) => 
        clinic.id === updatedClinic.id ? updatedClinic : clinic
      );
      setData({ ...data, clinics: updatedClinics });
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center minH="50vh">
          <VStack spacing={4}>
            <Spinner size="xl" />
            <Text>오늘의 클리닉 정보를 불러오는 중...</Text>
          </VStack>
        </Center>
      </Container>
    );
  }

  // 에러 발생
  if (error) {
    return (
      <Container maxW="container.xl" py={8}>
        <Alert status="error">
          <AlertIcon />
          <Box>
            <AlertTitle>오류 발생!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
        <Center mt={4}>
          <Button onClick={loadData} colorScheme="blue">
            다시 시도
          </Button>
        </Center>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8} pt="75px">
      <VStack spacing={6} align="stretch">
        {/* 헤더 */}
        <Box>
          <HStack justify="space-between" align="center" mt={2}>
            <HStack spacing={4}>
              <IconButton
                aria-label="뒤로가기"
                icon={<ArrowBackIcon />}
                onClick={() => router.back()}
                variant="outline"
              />
              <Heading size="lg">오늘의 클리닉</Heading>
              <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
                {data?.today_korean}
              </Badge>
            </HStack>
            {/* <Button
              leftIcon={<EditIcon />}
              onClick={loadData}
              variant="outline"
              colorScheme="blue"
            >
              새로고침
            </Button> */}
          </HStack>
          
          {/* <Text color="gray.600" fontSize="sm">
            오늘({data?.today_korean})의 클리닉 정보를 관리할 수 있습니다.
          </Text> */}
        </Box>

        {/* 클리닉 목록 */}
        <VStack spacing={6} align="stretch">
          {data?.clinics?.length === 0 ? (
            <Center py={16}>
              <VStack spacing={4}>
                <Text fontSize="lg" color="gray.500">
                  오늘은 진행되는 클리닉이 없습니다.
                </Text>
                <Text fontSize="sm" color="gray.400">
                  {data?.today_korean}에 등록된 클리닉이 없습니다.
                </Text>
              </VStack>
            </Center>
          ) : (
            data?.clinics?.map((clinic: Clinic) => (
              <ClinicCard
                key={clinic.id}
                clinic={clinic}
                students={data.students || []}
                onStudentUpdate={handleClinicUpdate}
              />
            ))
          )}
        </VStack>
      </VStack>
    </Container>
  );
};

export default TodayClinicPage; 