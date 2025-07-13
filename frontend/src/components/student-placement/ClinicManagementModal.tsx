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
  ModalFooter
} from '@chakra-ui/react';
import { Clinic } from '@/lib/types';
import { Student } from '@/components/student-placement/StudentItem';
import { getStudents, updateClinic } from '@/lib/api';

interface ClinicManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinic: Clinic | null;
  onUpdate: (clinic: Clinic) => void;
}

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
    
    // 해당 ID들에 해당하는 학생 객체들 반환
    return students.filter(student => uniqueStudentIds.includes(student.id));
  };

  const clinicStudents = getClinicStudents();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl">
      <ModalOverlay />
      <ModalContent maxW="80vw" maxH="90vh" minH="90vh" overflow="hidden">
        <ModalHeader>
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
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody overflow="hidden" display="flex" flexDirection="column">
          {loading ? (
            <Center py={10}>
              <Spinner size="lg" />
            </Center>
          ) : (
            <VStack spacing={4} align="stretch" h="100%" overflow="hidden">
              {/* 설명 */}
              {/* <Box flexShrink={0}>
                <Text fontSize="sm" color="gray.600">
                  학생 박스의 <Badge colorScheme="blue" size="sm">해설</Badge> 버튼을 클릭하면 18:00-19:00 해설 클리닉에 등록됩니다.
                </Text>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  <Badge colorScheme="green" size="sm">질문</Badge> 버튼을 클릭하면 19:00-22:00 자유 질문 클리닉에 등록됩니다.
                </Text>
              </Box> */}

              <Divider flexShrink={0} />

              {/* 학생 그리드 */}
              <Box flex="1" overflowY="auto" overflowX="hidden">
                {clinicStudents.length === 0 ? (
                  <Center py={10}>
                    <Text color="gray.500">
                      이 클리닉에 배치된 학생이 없습니다.
                    </Text>
                  </Center>
                ) : (
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