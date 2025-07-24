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
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태 관리
  const [studentToRemove, setStudentToRemove] = useState<User | null>(null); // 제거할 학생
  const [selectedTabIndex, setSelectedTabIndex] = useState(0); // 선택된 탭 인덱스
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure(); // 삭제 확인 다이얼로그
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

  // 학생을 클리닉에서 제거하는 함수
  const handleRemoveStudent = async (studentToRemove: User) => {
    const currentClinic = dayClinics[selectedTabIndex];
    if (!currentClinic) return;

    try {
      setIsLoading(true);
      console.log('🔍 [ClinicManagementModal] 학생 제거 시도:', studentToRemove.name || studentToRemove.username || studentToRemove.id);

      // 현재 학생 목록에서 해당 학생을 제거
      const updatedStudents = currentClinic.clinic_students.filter(
        student => student.id !== studentToRemove.id
      );

      // 클리닉 업데이트 API 호출
      const updatedClinic = await updateClinic(currentClinic.id, {
        ...currentClinic,
        clinic_students: updatedStudents.map(student => student.id) // ID 배열로 전송
      });

      // 상태 업데이트
      onUpdate(updatedClinic);

      // 성공 메시지 표시
      toast({
        title: '학생 제거 완료',
        description: `${studentToRemove.name || studentToRemove.username || '학생'}을 ${currentClinic.clinic_time} 클리닉에서 제거했습니다.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      console.log('✅ [ClinicManagementModal] 학생 제거 완료');

    } catch (error) {
      console.error('❌ [ClinicManagementModal] 학생 제거 오류:', error);
      
      toast({
        title: '학생 제거 실패',
        description: '학생 제거 중 오류가 발생했습니다. 다시 시도해주세요.',
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

  // 학생 제거 확인 다이얼로그 열기
  const openDeleteConfirmation = (student: User) => {
    setStudentToRemove(student);
    onDeleteOpen();
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

    const currentStudentCount = clinic.clinic_students?.length || 0;
    const remainingCapacity = clinic.clinic_capacity - currentStudentCount;
    const isFullCapacity = remainingCapacity <= 0;

    return (
      <VStack align="stretch" spacing={4}>
        {/* 시간대별 클리닉 기본 정보 */}
        {/* <Box p={4} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
          <VStack align="stretch" spacing={2}>
            <Flex justify="space-between" align="center">
              <Text fontSize="lg" fontWeight="bold" color="blue.800">
                {timeSlot}
              </Text>
              <Badge 
                colorScheme={isFullCapacity ? 'red' : 'green'} 
                fontSize="sm"
                px={3}
                py={1}
              >
                {currentStudentCount}/{clinic.clinic_capacity}명
              </Badge>
            </Flex>
            
            <HStack spacing={1}>
              <Text fontSize="sm" color="gray.600">
                담당 선생: {clinic.teacher_name}
              </Text>
              <Text fontSize="sm" color="gray.600">
                강의실: {clinic.clinic_room}
              </Text>
            </HStack>
          </VStack>
        </Box> */}

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
                      <Td fontWeight="semibold">{student.name || student.username || '이름 없음'}</Td>
                      <Td>{student.student_parent_phone_num || '-'}</Td>
                      <Td>{student.student_phone_num || '-'}</Td>
                      <Td>
                        <IconButton
                          aria-label="학생 제거"
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
              {/* 요일 정보 */}
              <Flex justify="space-between" align="center">
                <Text fontSize="xl" fontWeight="bold">
                  {dayDisplay} 보충 관리
                </Text>
              </Flex>
              
              {/* 전체 통계 정보 */}
              <HStack spacing={4}>
                <Text fontSize="sm" color="gray.600">
                  전체 통계:
                </Text>
                {TIME_SLOTS.map(timeSlot => {
                  const clinic = dayClinics.find(c => c?.clinic_time === timeSlot);
                  const count = clinic?.clinic_students?.length || 0;
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
          <ModalCloseButton />
          
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
              확인
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 학생 제거 확인 다이얼로그 */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              학생 제거 확인
            </AlertDialogHeader>

            <AlertDialogBody>
              <Text>
                <strong>{studentToRemove?.name || studentToRemove?.username || '알 수 없는 학생'}</strong> 학생을 
                이 클리닉에서 제거하시겠습니까?
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
                제거
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

export default ClinicManagementModal;