import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  ModalOverlay, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalCloseButton,
  Box,
  Flex,
  Text,
  Button,
  VStack,
  HStack,
  Badge,
  useToast,
  Spinner,
  Center,
  SimpleGrid,
  Divider,
  ModalFooter,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  IconButton,
  Tooltip,
  ButtonGroup
} from '@chakra-ui/react';
import { ViewIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { Clinic } from '@/lib/types';
import { Student } from '@/components/student-placement/StudentItem';
import { getStudents, updateClinic } from '@/lib/api';

interface ClinicManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinic: Clinic | null;
  onUpdate: (clinic: Clinic) => void;
}

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
    return nameA.localeCompare(nameB, 'ko');
  });
};

// 학생 박스 컴포넌트
const StudentBox: React.FC<{
  student: Student;
  isPrime: boolean;
  isSub: boolean;
  onTogglePrime: () => void;
  onToggleSub: () => void;
  isUpdating: boolean;
}> = ({ student, isPrime, isSub, onTogglePrime, onToggleSub, isUpdating }) => {
  return (
    <Box
      border="1px solid"
      borderColor="gray.300"
      borderRadius="md"
      p={2}
      bg="white"
      _hover={{ borderColor: 'blue.300' }}
      transition="all 0.2s"
      minH="120px"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
    >
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

      {/* 토글 버튼 */}
      <VStack spacing={1} mt={2}>
        <Button
          size="xs"
          colorScheme={isPrime ? 'blue' : 'gray'}
          variant={isPrime ? 'solid' : 'outline'}
          onClick={onTogglePrime}
          isLoading={isUpdating}
          width="100%"
          fontSize="xs"
        >
          해설
        </Button>
        <Button
          size="xs"
          colorScheme={isSub ? 'green' : 'gray'}
          variant={isSub ? 'solid' : 'outline'}
          onClick={onToggleSub}
          isLoading={isUpdating}
          width="100%"
          fontSize="xs"
        >
          질문
        </Button>
      </VStack>
    </Box>
  );
};

// 학생 테이블 행 컴포넌트
const StudentTableRow: React.FC<{
  student: Student;
  isPrime: boolean;
  isSub: boolean;
  onTogglePrime: () => void;
  onToggleSub: () => void;
  onRemove: () => void;
  isUpdating: boolean;
}> = ({ student, isPrime, isSub, onTogglePrime, onToggleSub, onRemove, isUpdating }) => {
  return (
    <Tr>
      <Td border="1px solid" borderColor="gray.200">{student.school}</Td>
      <Td border="1px solid" borderColor="gray.200">{student.grade}</Td>
      <Td border="1px solid" borderColor="gray.200" fontWeight="semibold">{student.student_name}</Td>
      <Td border="1px solid" borderColor="gray.200">{student.student_phone_num}</Td>
      <Td border="1px solid" borderColor="gray.200">{student.student_parent_phone_num}</Td>
      <Td border="1px solid" borderColor="gray.200" textAlign="center">
        <Button
          size="xs"
          bg={isPrime ? 'green.500' : 'red.500'}
          color="white"
          _hover={{ bg: isPrime ? 'green.600' : 'red.600' }}
          onClick={onTogglePrime}
          isLoading={isUpdating}
          width="60px"
        >
          {isPrime ? 'ON' : 'OFF'}
        </Button>
      </Td>
      <Td border="1px solid" borderColor="gray.200" textAlign="center">
        <Button
          size="xs"
          bg={isSub ? 'green.500' : 'red.500'}
          color="white"
          _hover={{ bg: isSub ? 'green.600' : 'red.600' }}
          onClick={onToggleSub}
          isLoading={isUpdating}
          width="60px"
        >
          {isSub ? 'ON' : 'OFF'}
        </Button>
      </Td>
      <Td border="1px solid" borderColor="gray.200" textAlign="center">
        <IconButton
          aria-label="배치 해제"
          icon={<DeleteIcon />}
          size="xs"
          colorScheme="red"
          variant="outline"
          onClick={onRemove}
          isLoading={isUpdating}
        />
      </Td>
    </Tr>
  );
};

const ClinicManagementModal: React.FC<ClinicManagementModalProps> = ({
  isOpen,
  onClose,
  clinic,
  onUpdate,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStudents, setUpdatingStudents] = useState<Set<number>>(new Set());
  const [localClinic, setLocalClinic] = useState<Clinic | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const toast = useToast();

  // 클리닉 데이터 로드
  useEffect(() => {
    if (clinic && isOpen) {
      setLocalClinic({ ...clinic });
      loadStudents();
    }
  }, [clinic, isOpen]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const studentsData = await getStudents();
      setStudents(studentsData);
    } catch (error) {
      console.error('학생 데이터 로드 실패:', error);
      toast({
        title: '학생 데이터 로드 실패',
        description: '학생 정보를 불러오는데 실패했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 학생의 현재 상태 확인
  const isStudentInPrime = (studentId: number): boolean => {
    return localClinic?.clinic_prime_students?.includes(studentId) || false;
  };

  const isStudentInSub = (studentId: number): boolean => {
    return localClinic?.clinic_sub_students?.includes(studentId) || false;
  };

  // 실시간 업데이트 처리
  const handleToggleStudent = async (studentId: number, section: 'prime' | 'sub') => {
    if (!localClinic) return;

    // 업데이트 중인 학생 표시
    setUpdatingStudents(prev => new Set(prev).add(studentId));

    try {
      // 현재 상태 확인
      const currentPrimeStudents = [...(localClinic.clinic_prime_students || [])];
      const currentSubStudents = [...(localClinic.clinic_sub_students || [])];
      const currentUnassignedStudents = [...(localClinic.clinic_unassigned_students || [])];
      
      // 현재 학생의 상태 확인
      const isPrimeNow = currentPrimeStudents.includes(studentId);
      const isSubNow = currentSubStudents.includes(studentId);
      
      // 토글 후 새로운 상태 계산
      let newPrimeState = isPrimeNow;
      let newSubState = isSubNow;
      
      if (section === 'prime') {
        newPrimeState = !isPrimeNow;
      } else {
        newSubState = !isSubNow;
      }

      // 새로운 배치 상태 계산
      let newPrimeStudents = currentPrimeStudents.filter(id => id !== studentId);
      let newSubStudents = currentSubStudents.filter(id => id !== studentId);
      let newUnassignedStudents = currentUnassignedStudents.filter(id => id !== studentId);

      // 새로운 상태에 따라 배치
      if (newPrimeState && newSubState) {
        // 해설 on && 질문 on -> prime, sub 둘 다 추가
        newPrimeStudents.push(studentId);
        newSubStudents.push(studentId);
      } else if (newPrimeState && !newSubState) {
        // 해설 on && 질문 off -> prime만 추가
        newPrimeStudents.push(studentId);
      } else if (!newPrimeState && newSubState) {
        // 해설 off && 질문 on -> sub만 추가
        newSubStudents.push(studentId);
      } else {
        // 해설 off && 질문 off -> unassigned에 추가
        newUnassignedStudents.push(studentId);
      }

      // 업데이트된 클리닉 데이터
      const updatedClinic = {
        ...localClinic,
        clinic_prime_students: newPrimeStudents,
        clinic_sub_students: newSubStudents,
        clinic_unassigned_students: newUnassignedStudents,
      };

      // API 호출
      const savedClinic = await updateClinic(localClinic.id, updatedClinic);
      
      // 로컬 상태 업데이트
      setLocalClinic(savedClinic);
      
      // 부모 컴포넌트에 변경사항 알림
      onUpdate(savedClinic);

      // 성공 메시지 (간단하게)
      toast({
        title: '업데이트 완료',
        status: 'success',
        duration: 1000,
        isClosable: true,
      });

    } catch (error) {
      console.error('클리닉 업데이트 실패:', error);
      toast({
        title: '업데이트 실패',
        description: '다시 시도해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      // 업데이트 중인 학생 상태 해제
      setUpdatingStudents(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  // 전체 학생 일괄 토글 처리
  const handleBulkToggle = async (section: 'prime' | 'sub') => {
    if (!localClinic) return;

    setBulkUpdating(true);
    
    try {
      const clinicStudents = getClinicStudents();
      const currentPrimeStudents = [...(localClinic.clinic_prime_students || [])];
      const currentSubStudents = [...(localClinic.clinic_sub_students || [])];
      const currentUnassignedStudents = [...(localClinic.clinic_unassigned_students || [])];

      // 현재 해당 섹션의 모든 학생 상태 확인
      const allStudentsInSection = clinicStudents.every(student => 
        section === 'prime' ? currentPrimeStudents.includes(student.id) : currentSubStudents.includes(student.id)
      );

      // 모든 학생이 해당 섹션에 있으면 제거, 아니면 추가
      const shouldAdd = !allStudentsInSection;

      let newPrimeStudents = [...currentPrimeStudents];
      let newSubStudents = [...currentSubStudents];
      let newUnassignedStudents = [...currentUnassignedStudents];

      clinicStudents.forEach(student => {
        const studentId = student.id;
        
        // 기존 배치에서 제거
        newPrimeStudents = newPrimeStudents.filter(id => id !== studentId);
        newSubStudents = newSubStudents.filter(id => id !== studentId);
        newUnassignedStudents = newUnassignedStudents.filter(id => id !== studentId);

        // 현재 상태 확인
        const wasPrime = currentPrimeStudents.includes(studentId);
        const wasSub = currentSubStudents.includes(studentId);
        
        let newPrimeState = wasPrime;
        let newSubState = wasSub;
        
        // 해당 섹션 상태 변경
        if (section === 'prime') {
          newPrimeState = shouldAdd;
        } else {
          newSubState = shouldAdd;
        }

        // 새로운 상태에 따라 배치
        if (newPrimeState && newSubState) {
          newPrimeStudents.push(studentId);
          newSubStudents.push(studentId);
        } else if (newPrimeState && !newSubState) {
          newPrimeStudents.push(studentId);
        } else if (!newPrimeState && newSubState) {
          newSubStudents.push(studentId);
        } else {
          newUnassignedStudents.push(studentId);
        }
      });

      // 업데이트된 클리닉 데이터
      const updatedClinic = {
        ...localClinic,
        clinic_prime_students: newPrimeStudents,
        clinic_sub_students: newSubStudents,
        clinic_unassigned_students: newUnassignedStudents,
      };

      // API 호출
      const savedClinic = await updateClinic(localClinic.id, updatedClinic);
      
      // 로컬 상태 업데이트
      setLocalClinic(savedClinic);
      
      // 부모 컴포넌트에 변경사항 알림
      onUpdate(savedClinic);

      // 성공 메시지
      toast({
        title: `전체 학생 ${section === 'prime' ? '해설' : '질문'} ${shouldAdd ? '등록' : '해제'} 완료`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });

    } catch (error) {
      console.error('일괄 업데이트 실패:', error);
      toast({
        title: '일괄 업데이트 실패',
        description: '다시 시도해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  // 학생 제거 처리
  const handleRemoveStudent = async (studentId: number) => {
    if (!localClinic) return;

    setUpdatingStudents(prev => new Set(prev).add(studentId));

    try {
      const currentPrimeStudents = [...(localClinic.clinic_prime_students || [])];
      const currentSubStudents = [...(localClinic.clinic_sub_students || [])];
      const currentUnassignedStudents = [...(localClinic.clinic_unassigned_students || [])];

      // 모든 배치에서 학생 제거
      const newPrimeStudents = currentPrimeStudents.filter(id => id !== studentId);
      const newSubStudents = currentSubStudents.filter(id => id !== studentId);
      const newUnassignedStudents = currentUnassignedStudents.filter(id => id !== studentId);

      // 업데이트된 클리닉 데이터
      const updatedClinic = {
        ...localClinic,
        clinic_prime_students: newPrimeStudents,
        clinic_sub_students: newSubStudents,
        clinic_unassigned_students: newUnassignedStudents,
      };

      // API 호출
      const savedClinic = await updateClinic(localClinic.id, updatedClinic);
      
      // 로컬 상태 업데이트
      setLocalClinic(savedClinic);
      
      // 부모 컴포넌트에 변경사항 알림
      onUpdate(savedClinic);

      // 성공 메시지
      toast({
        title: '학생 제거 완료',
        status: 'success',
        duration: 1000,
        isClosable: true,
      });

    } catch (error) {
      console.error('학생 제거 실패:', error);
      toast({
        title: '학생 제거 실패',
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

  if (!localClinic) return null;

  // 해당 클리닉에 배치된 학생들만 필터링
  const getClinicStudents = (): Student[] => {
    if (!localClinic) return [];
    
    // 해당 클리닉에 속한 모든 학생 ID들 (해설, 질문, 미배치 포함)
    const clinicStudentIds = [
      ...(localClinic.clinic_prime_students || []),
      ...(localClinic.clinic_sub_students || []),
      ...(localClinic.clinic_unassigned_students || [])
    ];
    
    // 중복 제거
    const uniqueStudentIds = Array.from(new Set(clinicStudentIds));
    
    // 해당 ID들에 해당하는 학생 객체들 반환 후 정렬
    const clinicStudents = students.filter(student => uniqueStudentIds.includes(student.id));
    return sortStudents(clinicStudents);
  };

  const clinicStudents = getClinicStudents();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent maxW="90vw" maxH="90vh" minH="90vh" overflow="hidden">
        <ModalHeader>
          <Flex justify="space-between" align="center">
            <HStack spacing={3}>
              <Text fontSize="lg" fontWeight="bold">
                클리닉 관리
              </Text>
              <Badge colorScheme="blue" fontSize="sm">
                {localClinic.clinic_day === 'mon' ? '월요일' :
                 localClinic.clinic_day === 'tue' ? '화요일' :
                 localClinic.clinic_day === 'wed' ? '수요일' :
                 localClinic.clinic_day === 'thu' ? '목요일' :
                 localClinic.clinic_day === 'fri' ? '금요일' : ''}
              </Badge>
              <Text fontSize="sm" color="gray.600">
                {localClinic.teacher_name} 선생님
              </Text>
            </HStack>
            
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
          </Flex>
        </ModalHeader>
        <ModalCloseButton display="none" />
        
        <ModalBody overflow="hidden" display="flex" flexDirection="column">
          {loading ? (
            <Center py={10}>
              <Spinner size="lg" />
            </Center>
          ) : (
            <VStack spacing={4} align="stretch" h="100%" overflow="hidden">
              <Divider flexShrink={0} />

              {/* 콘텐츠 영역 */}
              <Box flex="1" overflowY="auto" overflowX="hidden">
                {clinicStudents.length === 0 ? (
                  <Center py={10}>
                    <Text color="gray.500">
                      이 클리닉에 배치된 학생이 없습니다.
                    </Text>
                  </Center>
                ) : viewMode === 'box' ? (
                  // 박스 형식 보기
                  <SimpleGrid columns={6} spacing={3} pb={4}>
                    {clinicStudents.map(student => (
                      <StudentBox
                        key={student.id}
                        student={student}
                        isPrime={isStudentInPrime(student.id)}
                        isSub={isStudentInSub(student.id)}
                        onTogglePrime={() => handleToggleStudent(student.id, 'prime')}
                        onToggleSub={() => handleToggleStudent(student.id, 'sub')}
                        isUpdating={updatingStudents.has(student.id)}
                      />
                    ))}
                  </SimpleGrid>
                ) : (
                  // 표 형식 보기
                  <TableContainer border="1px solid" borderColor="gray.200" borderRadius="md">
                    <Table variant="simple" size="sm" style={{ borderCollapse: 'collapse' }}>
                      <Thead>
                        <Tr>
                          <Th border="1px solid" borderColor="gray.200">학교</Th>
                          <Th border="1px solid" borderColor="gray.200">학년</Th>
                          <Th border="1px solid" borderColor="gray.200">학생이름</Th>
                          <Th border="1px solid" borderColor="gray.200">학생번호</Th>
                          <Th border="1px solid" borderColor="gray.200">학부모번호</Th>
                          <Th border="1px solid" borderColor="gray.200" textAlign="center">
                            <Tooltip label="전체 학생 해설 토글">
                              <Button
                                size="xs"
                                colorScheme="blue"
                                variant="outline"
                                onClick={() => handleBulkToggle('prime')}
                                isLoading={bulkUpdating}
                              >
                                해설
                              </Button>
                            </Tooltip>
                          </Th>
                          <Th border="1px solid" borderColor="gray.200" textAlign="center">
                            <Tooltip label="전체 학생 질문 토글">
                              <Button
                                size="xs"
                                colorScheme="green"
                                variant="outline"
                                onClick={() => handleBulkToggle('sub')}
                                isLoading={bulkUpdating}
                              >
                                질문
                              </Button>
                            </Tooltip>
                          </Th>
                          <Th border="1px solid" borderColor="gray.200" textAlign="center">배치해제</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {clinicStudents.map(student => (
                          <StudentTableRow
                            key={student.id}
                            student={student}
                            isPrime={isStudentInPrime(student.id)}
                            isSub={isStudentInSub(student.id)}
                            onTogglePrime={() => handleToggleStudent(student.id, 'prime')}
                            onToggleSub={() => handleToggleStudent(student.id, 'sub')}
                            onRemove={() => handleRemoveStudent(student.id)}
                            isUpdating={updatingStudents.has(student.id)}
                          />
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </VStack>
          )}
        </ModalBody>
        
        <ModalFooter>
          {/* 통계 */}
          <Box pt={2} flexShrink={0}>
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
          </Box>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ClinicManagementModal; 