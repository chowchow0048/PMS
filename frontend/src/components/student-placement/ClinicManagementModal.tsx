import React, { useState } from 'react';
import { 
  Modal, 
  ModalOverlay, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalCloseButton,
  Text,
  Button,
  ModalFooter,
  useToast,
  Box,
  Flex,
  Badge,
  VStack,
  HStack,
  IconButton,
  Divider,
  Spinner,
  Center,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useDisclosure,
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
  TabPanel
} from '@chakra-ui/react';
import { DeleteIcon, InfoIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/navigation';
import { Clinic, User, DAY_CHOICES } from '@/lib/types';
import { updateClinic } from '@/lib/api';

interface ClinicManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | null; // 요일로 변경
  clinics: Clinic[]; // 전체 클리닉 배열
  onUpdate: (clinic: Clinic) => void;
}

// 시간대 선택지 정의
const TIME_SLOTS = ['18:00', '19:00', '20:00', '21:00'];

/**
 * 클리닉 관리 모달 컴포넌트
 * 관리자가 학생들의 클리닉 신청 현황을 시간대별 탭으로 실시간 확인하고 관리할 수 있는 모달
 */
const ClinicManagementModal: React.FC<ClinicManagementModalProps> = ({
  isOpen,
  onClose,
  day,
  clinics,
  onUpdate,
}) => {
  const toast = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태 관리
  const [studentToRemove, setStudentToRemove] = useState<User | null>(null); // 배치 해제할 학생
  const [selectedTabIndex, setSelectedTabIndex] = useState(0); // 선택된 탭 인덱스
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null); // 예약 정보를 보여줄 학생
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure(); // 삭제 확인 다이얼로그
  const { isOpen: isReservationInfoOpen, onOpen: onReservationInfoOpen, onClose: onReservationInfoClose } = useDisclosure(); // 예약 정보 모달
  const cancelRef = React.useRef<HTMLButtonElement>(null); // 삭제 확인 다이얼로그 취소 버튼 레퍼런스

  // 요일이 없는 경우 처리
  if (!day) {
    return null;
  }

  // 해당 요일의 시간대별 클리닉 찾기
  const dayClinics = TIME_SLOTS.map(timeSlot => 
    clinics.find(clinic => clinic.clinic_day === day && clinic.clinic_time === timeSlot)
  );

  // 요일 표시명 가져오기
  const dayDisplay = DAY_CHOICES.find(d => d.value === day)?.label || day;

  // 오늘의 보충 페이지로 이동하는 함수
  const handleGoToTodayClinic = () => {
    onClose(); // 모달 닫기
    router.push('/clinic/today'); // 오늘의 보충 페이지로 이동
  };

  // 학생을 클리닉에서 배치 해제하는 함수
  const handleRemoveStudent = async (studentToRemove: User) => {
    const currentClinic = dayClinics[selectedTabIndex];
    
    console.log('🔍 [ClinicManagementModal] === 학생 배치 해제 시작 ===');
    console.log('🔍 [ClinicManagementModal] selectedTabIndex:', selectedTabIndex);
    console.log('🔍 [ClinicManagementModal] currentClinic:', currentClinic);
    console.log('🔍 [ClinicManagementModal] studentToRemove:', {
      id: studentToRemove.id,
      name: studentToRemove.name,
      username: studentToRemove.username,
      is_student: studentToRemove.is_student
    });
    
    if (!currentClinic) {
      console.error('❌ [ClinicManagementModal] currentClinic이 없습니다!');
      return;
    }

    try {
      setIsLoading(true);
      
      console.log('🔍 [ClinicManagementModal] 클리닉 정보:', {
        id: currentClinic.id,
        clinic_day: currentClinic.clinic_day,
        clinic_time: currentClinic.clinic_time,
        clinic_capacity: currentClinic.clinic_capacity,
        current_students_count: currentClinic.clinic_students?.length || 0
      });
      
      console.log('🔍 [ClinicManagementModal] 현재 학생 목록:', 
        currentClinic.clinic_students?.map(s => ({ 
          id: s.id, 
          name: s.name || s.username, 
          is_student: s.is_student 
        })) || []
      );

      // 현재 학생 목록에서 해당 학생을 배치 해제
      const updatedStudents = currentClinic.clinic_students.filter(
        student => student.id !== studentToRemove.id
      );
      
      console.log('🔍 [ClinicManagementModal] 배치 해제 후 학생 목록:', 
        updatedStudents.map(s => ({ 
          id: s.id, 
          name: s.name || s.username, 
          is_student: s.is_student 
        }))
      );
      
      const studentIds = updatedStudents.map(student => student.id);
      console.log('🔍 [ClinicManagementModal] 전송할 학생 ID 배열:', studentIds);
      console.log('🔍 [ClinicManagementModal] 학생 ID들 타입 검증:', 
        studentIds.map((id, index) => `[${index}]: ${id} (type: ${typeof id}, isInteger: ${Number.isInteger(id)})`)
      );

      const updateData = {
        ...currentClinic,
        clinic_students: studentIds
      };
      console.log('🔍 [ClinicManagementModal] API 호출 데이터:', updateData);

      // 클리닉 업데이트 API 호출
      console.log('🔍 [ClinicManagementModal] updateClinic API 호출 시작...');
      const updatedClinic = await updateClinic(currentClinic.id, updateData);
      console.log('🔍 [ClinicManagementModal] updateClinic API 응답:', updatedClinic);

      // 상태 업데이트
      onUpdate(updatedClinic);

      // 성공 메시지 표시
      toast({
        title: '학생 배치 해제 완료',
        description: `${studentToRemove.name || studentToRemove.username || '학생'}을 ${currentClinic.clinic_time} 클리닉에서 배치 해제했습니다.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      console.log('✅ [ClinicManagementModal] 학생 배치 해제 완료');

    } catch (error) {
      console.error('❌ [ClinicManagementModal] 학생 배치 해제 오류:', error);
      
      // 오류 상세 정보 출력
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('❌ [ClinicManagementModal] 오류 상태:', axiosError.response?.status);
        console.error('❌ [ClinicManagementModal] 오류 데이터:', axiosError.response?.data);
        console.error('❌ [ClinicManagementModal] 요청 URL:', axiosError.config?.url);
        console.error('❌ [ClinicManagementModal] 요청 데이터:', axiosError.config?.data);
      }
      
      toast({
        title: '학생 배치 해제 실패',
        description: '학생 배치 해제 중 오류가 발생했습니다. 다시 시도해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
      onDeleteClose();
      setStudentToRemove(null);
    }
  };

  // 학생 배치 해제 확인 다이얼로그 열기
  const openDeleteConfirmation = (student: User) => {
    setStudentToRemove(student);
    onDeleteOpen();
  };

  // 학생 예약 정보 모달 열기
  const openReservationInfo = (student: User) => {
    setSelectedStudent(student);
    onReservationInfoOpen();
  };

  // 선택된 학생이 예약한 모든 클리닉 찾기
  const getStudentReservations = (student: User) => {
    const reservations: Array<{day: string, time: string, dayDisplay: string}> = [];
    
    // 모든 클리닉을 검사하여 해당 학생이 예약한 클리닉 찾기
    clinics.forEach(clinic => {
      if (clinic.clinic_students?.some(s => s.id === student.id)) {
        const dayDisplay = DAY_CHOICES.find(d => d.value === clinic.clinic_day)?.label || clinic.clinic_day;
        reservations.push({
          day: clinic.clinic_day,
          time: clinic.clinic_time,
          dayDisplay
        });
      }
    });
    
    return reservations;
  };

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

    const currentStudentCount = clinic.clinic_students?.filter(user => user.is_student).length || 0;
    const remainingCapacity = clinic.clinic_capacity - currentStudentCount;
    const isFullCapacity = remainingCapacity <= 0;

    return (
      <VStack align="stretch" spacing={4}>
        {/* 신청한 학생 목록 */}
        <Box>
          <Text fontSize="md" fontWeight="semibold" mb={3}>
            학생 목록
          </Text>
          
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
                    <Th>학부모님 전화번호</Th>
                    <Th>학생 전화번호</Th>
                    <Th width="100px">관리</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {clinic.clinic_students.map((student, index) => (
                    <Tr key={`student-${student.id}-${index}-${timeSlot}`}>
                      <Td>{index + 1}</Td>
                      <Td fontWeight="semibold">
                        <Text 
                          cursor="pointer" 
                          color="blue.500" 
                          _hover={{ color: "blue.600", textDecoration: "underline" }}
                          onClick={() => openReservationInfo(student)}
                        >
                          {student.name || student.username || '이름 없음'}
                        </Text>
                        {!student.is_student && (
                          <Badge ml={2} colorScheme="orange" size="sm">
                            {student.is_superuser ? '관리자' : '강사'}
                          </Badge>
                        )}
                      </Td>
                      <Td>{student.student_parent_phone_num || '-'}</Td>
                      <Td>{student.student_phone_num || '-'}</Td>
                      <Td>
                        <IconButton
                          aria-label={`${student.is_student ? '학생' : student.is_superuser ? '관리자' : '강사'} 배치 해제`}
                          icon={<DeleteIcon />}
                          size="sm"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => openDeleteConfirmation(student)}
                          isDisabled={isLoading}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </VStack>
    );
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent maxW="90vw" minH="90vh">
          <ModalHeader>
            <VStack align="stretch" spacing={2}>
              {/* 요일 정보와 오늘의 보충 버튼 */}
              <Flex justify="space-between" align="center">
                <Text fontSize="xl" fontWeight="bold">
                  {dayDisplay} 보충 관리
                </Text>
                <Button
                  colorScheme="blue"
                  size="sm"
                  onClick={handleGoToTodayClinic}
                >
                  오늘의 보충
                </Button>
              </Flex>
              
              {/* 전체 통계 정보 */}
              <HStack spacing={4}>
                <Text fontSize="sm" color="gray.600">
                  전체 통계:
                </Text>
                {TIME_SLOTS.map(timeSlot => {
                  const clinic = dayClinics.find(c => c?.clinic_time === timeSlot);
                  const count = clinic?.clinic_students?.filter(user => user.is_student).length || 0;
                  const capacity = clinic?.clinic_capacity || 0;
                  
                  return (
                    <Badge 
                      key={timeSlot}
                      colorScheme={clinic ? (count >= capacity ? 'red' : 'blue') : 'gray'}
                      size="sm"
                    >
                      {timeSlot}: {count}/{capacity}명
                    </Badge>
                  );
                })}
              </HStack>
            </VStack>
          </ModalHeader>
          
          <ModalBody>
            {isLoading ? (
              <Center py={8}>
                <Spinner size="lg" color="blue.500" />
              </Center>
            ) : (
              <Tabs index={selectedTabIndex} onChange={setSelectedTabIndex} variant="enclosed">
                {/* 시간대별 탭 헤더 */}
                <TabList>
                  {TIME_SLOTS.map((timeSlot, index) => {
                    const clinic = dayClinics[index];
                    const count = clinic?.clinic_students?.filter(user => user.is_student).length || 0;
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
                          <Text fontSize="sm" fontWeight="bold">
                            {timeSlot}
                          </Text>
                          <Badge 
                            size="xs" 
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
                    <TabPanel key={timeSlot} p={4}>
                      {renderClinicTimeTab(dayClinics[index], timeSlot)}
                      <Divider />
                    </TabPanel>
                  ))}
                </TabPanels>
              </Tabs>
            )}
          </ModalBody>
          
          <ModalFooter>
            <Button colorScheme="blue" onClick={onClose}>
              닫기
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 학생 배치 해제 확인 다이얼로그 */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              사용자 배치 해제 확인
            </AlertDialogHeader>

            <AlertDialogBody>
              <Text>
                <strong>{studentToRemove?.name || studentToRemove?.username || '알 수 없는 사용자'}</strong>
                {studentToRemove?.is_student ? ' 학생을' : studentToRemove?.is_superuser ? ' 관리자를' : ' 강사를'} 
                이 클리닉에서 배치 해제하시겠습니까?
              </Text>
              <Text fontSize="sm" color="gray.600" mt={2}>
                이 작업은 되돌릴 수 없습니다.
              </Text>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                취소
              </Button>
              <Button 
                colorScheme="red" 
                onClick={() => studentToRemove && handleRemoveStudent(studentToRemove)} 
                ml={3}
                isLoading={isLoading}
              >
                배치 해제
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* 학생 예약 정보 모달 */}
      <Modal isOpen={isReservationInfoOpen} onClose={onReservationInfoClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Text fontSize="lg" fontWeight="bold">
              예약 정보
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedStudent && (
              <VStack align="stretch" spacing={4}>
                {/* 학생 기본 정보 */}
                <Box p={4} bg="gray.50" borderRadius="md">
                  <Text fontSize="md" fontWeight="semibold" mb={2}>
                    {selectedStudent.name || selectedStudent.username || '이름 없음'}
                    {!selectedStudent.is_student && (
                      <Badge ml={2} colorScheme="orange" size="sm">
                        {selectedStudent.is_superuser ? '관리자' : '강사'}
                      </Badge>
                    )}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    사용자 ID: {selectedStudent.id}
                  </Text>
                  {selectedStudent.student_phone_num && (
                    <Text fontSize="sm" color="gray.600">
                      학생 전화번호: {selectedStudent.student_phone_num}
                    </Text>
                  )}
                  {selectedStudent.student_parent_phone_num && (
                    <Text fontSize="sm" color="gray.600">
                      학부모 전화번호: {selectedStudent.student_parent_phone_num}
                    </Text>
                  )}
                </Box>

                {/* 예약된 클리닉 목록 */}
                <Box>
                  <Text fontSize="md" fontWeight="semibold" mb={3}>
                    예약된 클리닉
                  </Text>
                  {(() => {
                    const reservations = getStudentReservations(selectedStudent);
                    if (reservations.length === 0) {
                      return (
                        <Box textAlign="center" py={4} color="gray.500">
                          <Text>예약된 클리닉이 없습니다.</Text>
                        </Box>
                      );
                    }
                    
                    return (
                      <VStack align="stretch" spacing={2}>
                        {reservations.map((reservation, index) => (
                          <Box
                            key={`${reservation.day}-${reservation.time}-${index}`}
                            p={3}
                            border="1px solid"
                            borderColor="blue.200"
                            borderRadius="md"
                            bg="blue.50"
                          >
                            <HStack justify="space-between">
                              <Text fontWeight="medium">
                                {reservation.dayDisplay} {reservation.time}
                              </Text>
                              <Badge colorScheme="blue" size="sm">
                                예약됨
                              </Badge>
                            </HStack>
                          </Box>
                        ))}
                      </VStack>
                    );
                  })()}
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onReservationInfoClose}>
              닫기
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ClinicManagementModal;