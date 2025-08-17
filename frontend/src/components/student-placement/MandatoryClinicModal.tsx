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
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { Student } from '@/lib/types';
import { getStudents, updateStudentNonPass } from '@/lib/api';

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
  const toast = useToast();

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
      // 필터링된 결과도 이름 오름차순으로 정렬
      const sortedFiltered = filtered.sort((a, b) => {
        return a.student_name.localeCompare(b.student_name, 'ko-KR');
      });
      setFilteredStudents(sortedFiltered);
    }
  }, [searchTerm, students]);

  // 학생 데이터 로드
  const loadStudents = async () => {
    try {
      setLoading(true);
      const studentsData = await getStudents();
      
      // 이름 오름차순으로 정렬
      const sortedStudents = studentsData.sort((a, b) => {
        return a.student_name.localeCompare(b.student_name, 'ko-KR');
      });
      
      setStudents(sortedStudents);
      setFilteredStudents(sortedStudents);
      console.log('🔍 [MandatoryClinicModal] 학생 데이터 로드 완료:', sortedStudents.length);
      console.log('🔍 [MandatoryClinicModal] 의무 클리닉 대상자:', sortedStudents.filter(s => s.non_pass).length, '명');
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
      <ModalOverlay bg="blackAlpha.300" />
      <ModalContent 
        maxH="90vh" 
        minH="80vh"
        minW="80vw"
        display="flex" 
        flexDirection="column"
      >
        <ModalHeader>
          <Text fontSize="xl" fontWeight="bold" color="gray.700">
            의무 클리닉 관리
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody flex="1" overflow="hidden" display="flex" flexDirection="column">
          {/* 검색 입력창 */}
          <Box mb={4}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
              </InputLeftElement>
              <Input
                placeholder="학생 이름, 아이디, 학교, 학년으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg="white"
                borderColor="gray.300"
                _focus={{
                  borderColor: "blue.500",
                  boxShadow: "0 0 0 1px #3182ce",
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
                  <Text color="gray.600">학생 명단을 불러오는 중...</Text>
                </VStack>
              </Center>
            ) : filteredStudents.length === 0 ? (
              <Center py={8}>
                <Text color="gray.500" fontSize="lg">
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
                    <Button
                      w="100%"
                      h="auto"
                      p={4}
                      variant="outline"
                      colorScheme={student.non_pass ? "red" : "gray"}
                      bg={student.non_pass ? "red.50" : "white"}
                      borderColor={student.non_pass ? "red.300" : "gray.300"}
                      _hover={{
                        bg: student.non_pass ? "red.100" : "gray.50",
                        transform: updating === student.id ? "none" : "translateY(-1px)",
                        shadow: updating === student.id ? "sm" : "md",
                      }}
                      transition="all 0.15s ease-in-out"
                      onClick={() => handleToggleNonPass(student)}
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
                              color={student.non_pass ? "red.700" : "gray.700"}
                              noOfLines={1}
                              flex="1"
                            >
                              {student.student_name}
                            </Text>
                            {student.non_pass && (
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
                          </Box>
                          <Text
                            fontSize="sm"
                            color={student.non_pass ? "red.600" : "gray.600"}
                            noOfLines={1}
                          >
                            {student.username}
                          </Text>
                        </Box>
                        
                        <Box textAlign="left">
                          <Text
                            fontSize="xs"
                            color={student.non_pass ? "red.500" : "gray.500"}
                          >
                            {student.school} {student.grade}
                          </Text>
                        </Box>
                      </VStack>
                    </Button>
                  </GridItem>
                ))}
              </Grid>
            )}
          </Box>

          {/* 통계 정보 */}
          <Box mt={4} p={3} bg="gray.50" borderRadius="md">
            <Text fontSize="sm" color="gray.600" textAlign="center">
              총 {students.length}명 중 의무 대상자{' '}
              <Text as="span" fontWeight="bold" color="red.600">
                {students.filter(s => s.non_pass).length}명
              </Text>
              {searchTerm && (
                <>
                  {' '}(검색 결과: {filteredStudents.length}명)
                </>
              )}
            </Text>
          </Box>
        </ModalBody>


      </ModalContent>
    </Modal>
  );
};

export default MandatoryClinicModal;
