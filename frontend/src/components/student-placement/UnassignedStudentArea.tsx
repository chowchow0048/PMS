'use client';

import { FC, useState, useEffect } from 'react';
import { 
  Box, 
  Heading, 
  SimpleGrid, 
  Text, 
  Input, 
  InputGroup, 
  InputLeftElement,
  Button,
  Flex,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  VStack,
  HStack,
  Badge,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Center
} from '@chakra-ui/react';
import { SearchIcon, AttachmentIcon, DownloadIcon, ChevronDownIcon, ChevronUpIcon, AddIcon } from '@chakra-ui/icons';
import { useDrop } from 'react-dnd';
import StudentItem, { ItemTypes } from './StudentItem'; // Student는 types.ts에서 import
import { Student } from '@/lib/types'; // types.ts에서 Student import
import { uploadStudentExcel } from '@/lib/api'; // 삭제된 함수들 제거
import * as XLSX from 'xlsx';
import { useCallback } from 'react';

// 미배치 학생 영역 컴포넌트 props 인터페이스
interface UnassignedStudentAreaProps {
  students: Student[];
  onUnassignStudent: (studentId: number) => void;
  onUnassignMultipleStudents?: (students: Student[]) => void; // 다중 학생 미배치 함수
  onRefresh?: () => void; // 데이터 새로고침 함수
  clearSelectionRef?: React.MutableRefObject<(() => void) | null>; // 선택 해제 함수 ref
  onStudentClick?: (student: Student | null) => void; // 학생 클릭 핸들러 (하이라이트용)
}

// 학교 구분의 정렬 순서 정의
const SCHOOL_ORDER = ['세화고', '세화여고', '연합반'];

// 학년 구분의 정렬 순서 정의
const GRADE_ORDER = ['1학년', '2학년', '3학년'];

// 미배치 학생 영역 컴포넌트
const UnassignedStudentArea: FC<UnassignedStudentAreaProps> = ({ 
  students, 
  onUnassignStudent,
  onUnassignMultipleStudents,
  onRefresh,
  clearSelectionRef,
  onStudentClick
}) => {
  // 검색어 상태 관리
  const [searchTerm, setSearchTerm] = useState('');
  
  // 접기/펼치기 상태 관리 (학교별)
  const [collapsedSchools, setCollapsedSchools] = useState<Set<string>>(new Set());
  
  // 접기/펼치기 상태 관리 (학교-학년별)
  const [collapsedGrades, setCollapsedGrades] = useState<Set<string>>(new Set());
  
  // 엑셀 업로드 관련 상태
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'student' | 'generate'>('student');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  // 다중 선택 관련 상태
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  // 마지막 선택된 학생의 그룹 정보 추가
  const [lastSelectedGroup, setLastSelectedGroup] = useState<string | null>(null);

  // 드롭 기능 구현 (배치된 학생이 다시 미배치 상태로 돌아올 때)
  const [{ isOver }, dropRef] = useDrop({
    accept: ItemTypes.STUDENT,
    drop: (item: { 
      id: number; 
      student: Student; 
      selectedStudents?: Student[]; 
      isMultiple?: boolean; 
    }) => {
      // 다중 선택된 학생들이 있는 경우
      if (item.isMultiple && item.selectedStudents && onUnassignMultipleStudents) {
        // 다중 학생 미배치 함수 사용
        onUnassignMultipleStudents(item.selectedStudents);
      } else {
        // 단일 학생 미배치
        onUnassignStudent(item.id);
      }
      
      // 드래그 완료 후 선택 해제
      clearSelection();
      
      return { unassigned: true };
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  // 파일 선택 핸들러
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 파일 확장자 검증
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast({
          title: '파일 형식 오류',
          description: '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  // 엑셀 양식 다운로드 핸들러
  const handleDownloadTemplate = () => {
    const headers = ['학교', '학년', '이름', '학부모 전화번호', '학생 전화번호'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '학생 명단');
    XLSX.writeFile(workbook, '학생_명단_양식.xlsx');
  };

  // 엑셀 업로드 핸들러
  const handleUploadExcel = async () => {
    if (!selectedFile) {
      toast({
        title: '파일 선택 필요',
        description: '업로드할 엑셀 파일을 선택해주세요.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsUploading(true);
    try {
      let result;
      
      if (uploadType === 'student') {
        result = await uploadStudentExcel(selectedFile);
        
        const successCount = result.added_students?.length || 0;
        const duplicateCount = result.duplicate_students?.length || 0;
        const errorCount = result.error_students?.length || 0;

        if (errorCount > 0) {
            toast({
                title: '일부 학생 업로드 실패',
                description: `총 ${result.total_rows}행 중 ${successCount}명 추가, ${duplicateCount}명 중복, ${errorCount}명 오류`,
                status: 'warning',
                duration: 7000,
                isClosable: true,
            });
        } else {
            toast({
                title: '학생 명단 업로드 완료',
                description: `총 ${result.total_rows}행 중 ${successCount}명 추가, ${duplicateCount}명 중복`,
                status: 'success',
                duration: 5000,
                isClosable: true,
            });
        }

      } else {
        // 학생 아이디 생성 기능은 비활성화되었으므로, 업로드 결과는 항상 null 또는 빈 객체
        result = { total_rows: 0, added_students: [], duplicate_students: [], error_students: [] };
        toast({
          title: '학생 아이디 생성 기능 비활성화',
          description: '학생 아이디 생성 기능은 현재 비활성화되어 있습니다.',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
      }
      
      setUploadResult(result);

      // 데이터 새로고침
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('엑셀 업로드 오류:', error);
      const errorData = error.response?.data;
      let description = '파일 업로드 중 오류가 발생했습니다.';

      if (errorData?.error_students && errorData.error_students.length > 0) {
        const firstError = errorData.error_students[0];
        description = `행 ${firstError.row}: ${firstError.name} - ${firstError.error}`;
      } else if (errorData?.error) {
        description = errorData.error;
      }

      toast({
        title: '업로드 실패',
        description: description,
        status: 'error',
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // 업로드 모달 열기 함수
  const handleOpenModal = (type: 'student' | 'generate') => {
    setUploadType(type);
    setSelectedFile(null);
    setUploadResult(null);
    onOpen();
  };

  // 업로드 모달 닫기 함수
  const handleCloseModal = () => {
    setSelectedFile(null);
    setUploadResult(null);
    onClose();
  };

  // 학생 아이디 생성 처리 함수
  const handleGenerateStudentUsers = async () => {
    try {
      setIsUploading(true);
      console.log('🔍 [UnassignedStudentArea] 학생 아이디 생성 시작');
      
      // 학생 아이디 생성 기능은 비활성화되었으므로, 업로드 결과는 항상 null 또는 빈 객체
      const result = { total_processed: 0, success_count: 0, skipped_users: [], duplicate_count: 0, error_count: 0, created_users: [], error_users: [] };
      console.log('🔍 [UnassignedStudentArea] 학생 아이디 생성 완료:', result);
      
      setUploadResult(result);
      
      // 성공 토스트
      toast({
        title: '학생 아이디 생성 완료',
        description: `생성: ${result.success_count || 0}명, 중복: ${result.duplicate_count || 0}명, 오류: ${result.error_count || 0}명`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // 데이터 새로고침
      if (onRefresh) {
        onRefresh();
      }
      
    } catch (error) {
      console.error('❌ [UnassignedStudentArea] 학생 아이디 생성 오류:', error);
      toast({
        title: '학생 아이디 생성 실패',
        description: '서버 오류가 발생했습니다. 다시 시도해주세요.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // 학생 선택 핸들러
  const handleStudentSelect = (student: Student, event: React.MouseEvent, school: string, grade: string) => {
    event.preventDefault();
    event.stopPropagation();

    // 현재 그룹의 학생들만 가져오기
    const currentGroupStudents = groupedStudents[school]?.[grade] || [];
    const studentIndex = currentGroupStudents.findIndex(s => s.id === student.id);
    const currentGroup = `${school}-${grade}`;
    
    // 하이라이트용 클릭 이벤트 전송
    if (onStudentClick) {
      onStudentClick(student);
    }
    
    if (event.shiftKey && lastSelectedIndex !== null && lastSelectedGroup === currentGroup) {
      // Shift+클릭: 같은 그룹 내에서만 범위 선택
      const start = Math.min(lastSelectedIndex, studentIndex);
      const end = Math.max(lastSelectedIndex, studentIndex);
      const newSelected = new Set(selectedStudents);
      
      for (let i = start; i <= end; i++) {
        if (i < currentGroupStudents.length) {
          newSelected.add(currentGroupStudents[i].id);
        }
      }
      
      setSelectedStudents(newSelected);
    } else if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl+클릭: 개별 토글
      const newSelected = new Set(selectedStudents);
      if (newSelected.has(student.id)) {
        newSelected.delete(student.id);
      } else {
        newSelected.add(student.id);
      }
      setSelectedStudents(newSelected);
      setLastSelectedIndex(studentIndex);
      setLastSelectedGroup(currentGroup);
    } else {
      // 일반 클릭: 단일 선택
      setSelectedStudents(new Set([student.id]));
      setLastSelectedIndex(studentIndex);
      setLastSelectedGroup(currentGroup);
    }
  };

  // 선택 해제
  const clearSelection = useCallback(() => {
    setSelectedStudents(new Set());
    setLastSelectedIndex(null);
    setLastSelectedGroup(null);
    // 하이라이트도 해제
    if (onStudentClick) {
      onStudentClick(null);
    }
  }, [onStudentClick]);

  // 검색어에 따른 학생 필터링
  const filteredStudents = students.filter(student => 
    student.student_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 학교와 학년별로 학생들 그룹화
  const groupedStudents: Record<string, Record<string, Student[]>> = {};
  
  // 학교와 학년별로 학생 그룹화
  filteredStudents.forEach(student => {
    const school = student.school;
    const grade = student.grade;
    
    if (!groupedStudents[school]) {
      groupedStudents[school] = {};
    }
    if (!groupedStudents[school][grade]) {
      groupedStudents[school][grade] = [];
    }
    groupedStudents[school][grade].push(student);
  });

  // 각 그룹 내에서 학생들을 이름순으로 정렬
  Object.keys(groupedStudents).forEach(school => {
    Object.keys(groupedStudents[school]).forEach(grade => {
      groupedStudents[school][grade].sort((a, b) => 
        a.student_name.localeCompare(b.student_name, 'ko')
      );
    });
  });

  // 학교 섹션 토글 핸들러
  const toggleSchool = (school: string) => {
    const newCollapsed = new Set(collapsedSchools);
    if (newCollapsed.has(school)) {
      newCollapsed.delete(school);
    } else {
      newCollapsed.add(school);
    }
    setCollapsedSchools(newCollapsed);
  };

  // 학년 섹션 토글 핸들러
  const toggleGrade = (school: string, grade: string) => {
    const key = `${school}-${grade}`;
    const newCollapsed = new Set(collapsedGrades);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedGrades(newCollapsed);
  };

  // clearSelectionRef에 clearSelection 함수 할당
  useEffect(() => {
    if (clearSelectionRef) {
      clearSelectionRef.current = clearSelection;
    }
  }, [clearSelectionRef, clearSelection]);

  return (
    <Box
      ref={dropRef as any}
      bg={isOver ? 'gray.100' : 'gray.50'}
      borderRadius="md"
      width="100%"
      height="100%"
      display="flex"
      flexDirection="column"
    >
      {/* 헤더: 제목과 엑셀 업로드 버튼 (고정) */}
      <Box p={4} pb={2} flexShrink={0}>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading as="h2" size="lg">
            학생 명단
          </Heading>
          <HStack spacing={2}>
            {selectedStudents.size > 0 && (
              <>
                <Text fontSize="sm" color="blue.600" fontWeight="medium">
                  {selectedStudents.size}명 선택됨
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="blue"
                  onClick={clearSelection}
                >
                  선택 해제
                </Button>
              </>
            )}
                           <Button
               leftIcon={<AttachmentIcon />}
               colorScheme="blue"
               variant="solid"
               size="md"
               bg="blue.600"
               _hover={{ bg: "blue.400" }}
               onClick={() => handleOpenModal('student')}
               mr={2}
             >
               학생 명단
               </Button>
               {/* <Button
               leftIcon={<AddIcon />}
               colorScheme="green"
               variant="solid"
               size="md"
               bg="green.600"
               _hover={{ bg: "green.400" }}
               onClick={() => handleOpenModal('generate')}
               isDisabled={true} // 기능 비활성화
             >
               학생아이디 생성 (비활성화)
               </Button> */}
          </HStack>
        </Flex>
        
        {/* 검색 입력란 */}
        <InputGroup>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input 
            placeholder="학생 이름 검색" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            bg="white"
            borderColor="gray.300"
          />
        </InputGroup>
      </Box>
      
      {/* 학생 목록 (스크롤 가능) */}
      <Box flex={1} overflowY="auto" px={4} pb={4}>
        {/* 학교와 학년 구분 섹션 */}
        {filteredStudents.length > 0 || searchTerm === '' ? (
          // 정의된 순서대로 학교 섹션 렌더링
          SCHOOL_ORDER.map(school => {
            // 해당 학교의 학생이 없고 검색 중이 아닐 때는 표시하지 않음
            if (!groupedStudents[school] && searchTerm === '') return null;
            
            return (
              <Box key={school} mb={6}>
                <Flex 
                  align="center" 
                  justify="space-between" 
                  cursor="pointer"
                  onClick={() => toggleSchool(school)}
                  _hover={{ bg: 'gray.100' }}
                  p={2}
                  borderRadius="md"
                  transition="background-color 0.2s"
                >
                  <Heading as="h3" size="md" mb={0}>
                    {school}
                  </Heading>
                  {collapsedSchools.has(school) ? 
                    <ChevronUpIcon boxSize={5} /> : 
                    <ChevronDownIcon boxSize={5} />
                  }
                </Flex>
                
                {/* 학교가 접혀있지 않을 때만 학년별 섹션 렌더링 */}
                {!collapsedSchools.has(school) && (
                  <>
                    {/* 학년별 섹션 렌더링 */}
                    {GRADE_ORDER.map(grade => {
                      const students = groupedStudents[school]?.[grade] || [];
                      const gradeKey = `${school}-${grade}`;
                      
                      // 검색 중이 아닐 때는 빈 섹션도 표시
                      if (searchTerm !== '' && students.length === 0) return null;
                      
                      return (
                        <Box key={gradeKey} mb={4} ml={4}>
                          <Flex 
                            align="center" 
                            justify="space-between" 
                            cursor="pointer"
                            onClick={(e) => toggleGrade(school, grade)}
                            _hover={{ bg: 'gray.50' }}
                            p={2}
                            borderRadius="md"
                            transition="background-color 0.2s"
                          >
                            <Heading as="h4" size="sm" mb={0}>
                              {grade}
                            </Heading>
                            {collapsedGrades.has(gradeKey) ? 
                              <ChevronUpIcon boxSize={4} /> : 
                              <ChevronDownIcon boxSize={4} />
                            }
                          </Flex>
                          
                          {/* 학년이 접혀있지 않을 때만 학생 목록 렌더링 */}
                          {!collapsedGrades.has(gradeKey) && (
                            <Box mt={2}>
                              {students.length > 0 ? (
                                <SimpleGrid columns={[2, 3, 4]} spacing={2}>
                                  {students.map(student => (
                                    <StudentItem 
                                      key={student.id} 
                                      student={student} 
                                      isAssigned={false}
                                      isHighlighted={searchTerm.length > 0 && student.student_name.toLowerCase().includes(searchTerm.toLowerCase())}
                                      isSelected={selectedStudents.has(student.id)}
                                      onSelect={(student, event) => handleStudentSelect(student, event, school, grade)}
                                      selectedStudents={filteredStudents.filter(s => selectedStudents.has(s.id))}
                                    />
                                  ))}
                                </SimpleGrid>
                              ) : (
                                <Text color="gray.500" fontSize="sm" py={2}>
                                  해당 학년에 학생이 없습니다
                                </Text>
                              )}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </>
                )}
              </Box>
            );
          })
        ) : (
          <Text color="gray.500">검색 결과가 없습니다.</Text>
        )}
      </Box>
      
      {/* 엑셀 업로드 모달 */}
      <Modal isOpen={isOpen} onClose={handleCloseModal} size="xl">
        <ModalOverlay />
        <ModalContent>
                     <ModalHeader>
            {uploadType === 'student' ? '학생 명단 업로드' : '학생 아이디 생성'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* 파일 업로드 안내 */}
              <Alert status="info">
                <AlertIcon />
                <Box>
                  <AlertTitle>
                    {uploadType === 'student' ? '업로드 형식 안내' : '아이디 생성 기능 비활성화'}
                  </AlertTitle>
                  <AlertDescription>
                    {uploadType === 'student' ? (
                      <>
                        엑셀 파일에는 다음 컬럼이 포함되어야 합니다:<br />
                        <strong>학교, 학년, 이름, 학부모 전화번호</strong> (학생 전화번호는 선택사항)
                      </>
                    ) : (
                      <>
                        학생 아이디 생성 기능은 현재 시스템 개편으로 인해 비활성화되어 있습니다.<br />
                        <strong>필요시 관리자에게 문의해주세요.</strong>
                      </>
                    )}
                  </AlertDescription>
                </Box>
              </Alert>

              {/* 파일 선택 및 양식 다운로드 (학생 명단 업로드일 때만) */}
              {uploadType === 'student' && (
                <Box>
                  <Flex justify="space-between" align="center" mb={2}>
                    <Text fontWeight="medium">파일 선택</Text>
                    <Button 
                      size="sm" 
                      leftIcon={<DownloadIcon />} 
                      onClick={handleDownloadTemplate}
                      variant="outline"
                    >
                      엑셀 양식 다운로드
                    </Button>
                  </Flex>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    p={1}
                  />
                  {selectedFile && (
                    <Text mt={2} fontSize="sm" color="green.600">
                      선택된 파일: {selectedFile.name}
                    </Text>
                  )}
                </Box>
              )}

              {/* 학생 아이디 생성일 때 안내 메시지 */}
              {uploadType === 'generate' && (
                <Box>
                  <Text fontWeight="medium" mb={2}>아이디 생성 규칙</Text>
                  <VStack align="stretch" spacing={2}>
                    <Text fontSize="sm">• 연도(2자리) + 학교코드(2자리) + 학년(1자리) + 학생ID(3자리)</Text>
                    <Text fontSize="sm">• 예: 25011001 (2025년 세화고 1학년 학생ID 1번)</Text>
                    <Text fontSize="sm">• 초기 비밀번호는 아이디와 동일합니다</Text>
                  </VStack>
                </Box>
              )}

                  {/* 업로드 결과 표시 */}
                  {uploadResult && (
                    <Box>
                      <Divider my={4} />
                      <Text fontWeight="bold" mb={3}>
                        {uploadType === 'student' ? '업로드 결과' : '아이디 생성 결과'}
                      </Text>
                      
                      <VStack spacing={3} align="stretch">
                        {/* 요약 정보 */}
                        <HStack spacing={4}>
                          {uploadType === 'student' ? (
                            <>
                              <Badge colorScheme="blue">총 {uploadResult.total_rows}행</Badge>
                              <Badge colorScheme="green">추가 {uploadResult.added_students?.length || 0}명</Badge>
                              <Badge colorScheme="yellow">중복 {uploadResult.duplicate_students?.length || 0}명</Badge>
                              <Badge colorScheme="red">오류 {uploadResult.error_students?.length || 0}명</Badge>
                            </>
                          ) : (
                            <>
                              <Badge colorScheme="blue">처리 {uploadResult.total_processed || 0}명</Badge>
                              <Badge colorScheme="green">생성 {uploadResult.success_count || 0}명</Badge>
                              <Badge colorScheme="purple">건너뜀 {uploadResult.skipped_users?.length || 0}명</Badge>
                              <Badge colorScheme="yellow">중복 {uploadResult.duplicate_count || 0}명</Badge>
                              <Badge colorScheme="red">오류 {uploadResult.error_count || 0}명</Badge>
                            </>
                          )}
                        </HStack>

                        {/* 성공 결과 목록 */}
                        {uploadType === 'student' ? (
                          uploadResult.added_students?.length > 0 && (
                            <Box>
                              <Text fontWeight="medium" color="green.600" mb={2}>
                                추가된 학생 ({uploadResult.added_students.length}명)
                              </Text>
                              <Box maxH="150px" overflowY="auto" bg="green.50" p={2} borderRadius="md">
                                {uploadResult.added_students.map((student: any, index: number) => (
                                  <Text key={index} fontSize="sm">
                                    {student.name} ({student.school} {student.grade})
                                  </Text>
                                ))}
                              </Box>
                            </Box>
                          )
                        ) : (
                          uploadResult.created_users?.length > 0 && (
                            <Box>
                              <Text fontWeight="medium" color="green.600" mb={2}>
                                생성된 아이디 ({uploadResult.created_users.length}명)
                              </Text>
                              <Box maxH="150px" overflowY="auto" bg="green.50" p={2} borderRadius="md">
                                {uploadResult.created_users.map((user: any, index: number) => (
                                  <Text key={index} fontSize="sm">
                                    {user.student_name}: {user.username}
                                  </Text>
                                ))}
                              </Box>
                            </Box>
                          )
                        )}

                        {/* 건너뛴 학생 목록 (아이디 생성 시에만) */}
                        {uploadType === 'generate' && uploadResult.skipped_users?.length > 0 && (
                          <Box>
                            <Text fontWeight="medium" color="purple.600" mb={2}>
                              건너뛴 학생 ({uploadResult.skipped_users.length}명)
                            </Text>
                            <Box maxH="150px" overflowY="auto" bg="purple.50" p={2} borderRadius="md">
                              {uploadResult.skipped_users.map((user: any, index: number) => (
                                <Text key={index} fontSize="sm">
                                  {user.student_name}: {user.reason}
                                </Text>
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* 중복/미발견 학생 목록 */}
                        {uploadType === 'student' ? (
                          uploadResult.duplicate_students?.length > 0 && (
                            <Box>
                              <Text fontWeight="medium" color="yellow.600" mb={2}>
                                중복된 학생 ({uploadResult.duplicate_students.length}명)
                              </Text>
                              <Box maxH="150px" overflowY="auto" bg="yellow.50" p={2} borderRadius="md">
                                {uploadResult.duplicate_students.map((student: any, index: number) => (
                                  <Text key={index} fontSize="sm">
                                    행 {student.row}: {student.name} ({student.school} {student.grade})
                                  </Text>
                                ))}
                              </Box>
                            </Box>
                          )
                        ) : (
                          uploadResult.duplicate_users?.length > 0 && (
                            <Box>
                              <Text fontWeight="medium" color="yellow.600" mb={2}>
                                중복된 사용자 ({uploadResult.duplicate_users.length}명)
                              </Text>
                              <Box maxH="150px" overflowY="auto" bg="yellow.50" p={2} borderRadius="md">
                                {uploadResult.duplicate_users.map((user: any, index: number) => (
                                  <Text key={index} fontSize="sm">
                                    {user.student_name}: {user.duplicate_reason}
                                  </Text>
                                ))}
                              </Box>
                            </Box>
                          )
                        )}

                        {/* 오류 학생 목록 */}
                        {uploadResult.error_students?.length > 0 && uploadType === 'student' && (
                          <Box>
                            <Text fontWeight="medium" color="red.600" mb={2}>
                              오류 발생 ({uploadResult.error_students.length}명)
                            </Text>
                            <Box maxH="150px" overflowY="auto" bg="red.50" p={2} borderRadius="md">
                              {uploadResult.error_students.map((student: any, index: number) => (
                                <Text key={index} fontSize="sm">
                                  행 {student.row}: {student.name} - {student.error}
                                </Text>
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* 오류 사용자 목록 (아이디 생성 시) */}
                        {uploadResult.error_users?.length > 0 && uploadType === 'generate' && (
                          <Box>
                            <Text fontWeight="medium" color="red.600" mb={2}>
                              오류 발생 ({uploadResult.error_users.length}명)
                            </Text>
                            <Box maxH="150px" overflowY="auto" bg="red.50" p={2} borderRadius="md">
                              {uploadResult.error_users.map((user: any, index: number) => (
                                <Text key={index} fontSize="sm">
                                  {user.student_name}: {user.error}
                                </Text>
                              ))}
                            </Box>
                          </Box>
                        )}
                      </VStack>
                    </Box>
                  )}
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseModal}>
              닫기
            </Button>
            {uploadType === 'student' ? (
              <Button
                colorScheme="blue"
                onClick={handleUploadExcel}
                isLoading={isUploading}
                loadingText="업로드 중..."
                isDisabled={!selectedFile || isUploading}
              >
                업로드
              </Button>
            ) : (
              <Button
                colorScheme="green"
                onClick={handleGenerateStudentUsers}
                isLoading={isUploading}
                loadingText="생성 중..."
                isDisabled={true} // 기능 비활성화
              >
                아이디 생성 (비활성화)
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default UnassignedStudentArea;
