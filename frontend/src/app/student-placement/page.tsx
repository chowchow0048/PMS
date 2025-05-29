'use client';

import { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Box, Flex, Container, Heading, Grid, GridItem, Spinner, Center, useToast } from '@chakra-ui/react';
import UnassignedStudentArea from '@/components/student-placement/UnassignedStudentArea';
import TeacherBox from '@/components/student-placement/TeacherBox';
import { Student } from '@/components/student-placement/StudentItem';
import { Teacher } from '@/components/student-placement/TeacherBox';
import { getStudents, getTeachers, assignStudent, unassignStudent } from '@/lib/api';
import { AuthGuard } from '@/lib/authGuard';

// 학생 배치 페이지 컴포넌트 (관리자 전용)
function StudentPlacementPageContent() {
  // 상태 관리
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<Record<number, Student[]>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  
  // 선택 해제 함수를 위한 ref
  const clearSelectionRef = useRef<(() => void) | null>(null);

  // 초기 데이터 로딩
  useEffect(() => {
    fetchData();
  }, []);

  // 데이터 로딩 함수
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 선생님 데이터 로드
      const teachersData = await getTeachers();
      
      // 선생님 데이터가 배열인지 확인하고, 배열이 아니면 빈 배열로 설정
      const teachersArray = Array.isArray(teachersData) ? teachersData : [];
      // const filteredTeachers = teachersArray.filter(teacher => !teacher.is_superuser);
      // console.log('filteredTeachers', filteredTeachers);
      // console.log('teachersArray', teachersArray);
      // setTeachers(filteredTeachers);
      setTeachers(teachersArray);
      
      // 학생 데이터 로드
      const studentsData = await getStudents();
      // console.log('studentsData', studentsData);
      const studentsArray = Array.isArray(studentsData) ? studentsData : 
                          (studentsData && (studentsData as any).results ? (studentsData as any).results : []);
      // console.log('학생 데이터:', studentsArray);
      
      // 미배치 학생과 배치된 학생 분류
      const unassigned: Student[] = [];
      const assigned: Record<number, Student[]> = {};
      
      // 선생님별 학생 배열 초기화
      teachersArray.forEach((teacher: Teacher) => {
        assigned[teacher.id] = [];
      });
      
      // 학생 분류
      studentsArray.forEach((student: Student) => {
        if (student.assigned_teacher) {
          const teacherId = student.assigned_teacher;
          if (assigned[teacherId]) {
            assigned[teacherId].push(student);
          }
        } else {
          unassigned.push(student);
        }
      });
      
      setUnassignedStudents(unassigned);
      setAssignedStudents(assigned);
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
      toast({
        title: '데이터 로딩 실패',
        description: '학생 및 선생님 데이터를 불러오는데 실패했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 데이터 로딩 중일 때 로딩 표시
  if (loading) {
    return (
      <Center h="calc(100vh - 100px)" w="100%">
        <Spinner size="xl" color="blue.500" thickness="4px" />
      </Center>
    );
  }

  // 학생 배치 처리 함수 (단일)
  const handleAssignStudent = async (studentId: number, teacherId: number) => {
    try {
      // API 호출
      await assignStudent(studentId, teacherId);
      
      // 상태 업데이트
      const student = [...unassignedStudents, ...Object.values(assignedStudents).flat()]
        .find(s => s.id === studentId);
      
      if (!student) return;
      
      // 현재 배치된 선생님에게서 학생 제거
      const newUnassignedStudents = unassignedStudents.filter(s => s.id !== studentId);
      const newAssignedStudents = { ...assignedStudents };
      
      // 모든 선생님의 학생 목록에서 해당 학생 제거
      Object.keys(newAssignedStudents).forEach(key => {
        const tId = Number(key);
        newAssignedStudents[tId] = newAssignedStudents[tId].filter(s => s.id !== studentId);
      });
      
      // 새로운 선생님에게 학생 배치
      newAssignedStudents[teacherId] = [...newAssignedStudents[teacherId], student];
      
      setUnassignedStudents(newUnassignedStudents);
      setAssignedStudents(newAssignedStudents);
      
    } catch (error) {
      console.error('학생 배치 오류:', error);
      toast({ 
        title: '학생 배치 실패',
        description: '서버 오류가 발생했습니다. 다시 시도해주세요.',
        status: 'error',
        duration: 1000,
        isClosable: true,
      });
    }
  };

  // 다중 학생 배치 처리 함수
  const handleAssignMultipleStudents = async (students: Student[], teacherId: number) => {
    try {
      // 모든 학생에 대해 API 호출
      await Promise.all(students.map(student => assignStudent(student.id, teacherId)));
      
      // 상태 업데이트
      const studentIds = students.map(s => s.id);
      
      // 미배치 학생 목록에서 해당 학생들 제거
      const newUnassignedStudents = unassignedStudents.filter(s => !studentIds.includes(s.id));
      const newAssignedStudents = { ...assignedStudents };
      
      // 모든 선생님의 학생 목록에서 해당 학생들 제거
      Object.keys(newAssignedStudents).forEach(key => {
        const tId = Number(key);
        newAssignedStudents[tId] = newAssignedStudents[tId].filter(s => !studentIds.includes(s.id));
      });
      
      // 새로운 선생님에게 학생들 배치
      newAssignedStudents[teacherId] = [...newAssignedStudents[teacherId], ...students];
      
      setUnassignedStudents(newUnassignedStudents);
      setAssignedStudents(newAssignedStudents);
      
    } catch (error) {
      console.error('다중 학생 배치 오류:', error);
      toast({ 
        title: '학생 배치 실패',
        description: '서버 오류가 발생했습니다. 다시 시도해주세요.',
        status: 'error',
        duration: 1000,
        isClosable: true,
      });
    }
  };

  // 학생 미배치 처리 함수
  const handleUnassignStudent = async (studentId: number) => {
    try {
      // API 호출
      await unassignStudent(studentId);
      
      // 상태 업데이트
      let student: Student | undefined;
      
      // 배치된 학생 중에서 찾기
      Object.values(assignedStudents).forEach(students => {
        const found = students.find(s => s.id === studentId);
        if (found) student = found;
      });
      
      if (!student) return;
      
      // 모든 선생님에게서 해당 학생 제거
      const newAssignedStudents = { ...assignedStudents };
      Object.keys(newAssignedStudents).forEach(key => {
        const teacherId = Number(key);
        newAssignedStudents[teacherId] = newAssignedStudents[teacherId].filter(s => s.id !== studentId);
      });
      
      // 미배치 학생 목록에 추가 (이름순으로 정렬)
      const newUnassignedList = [...unassignedStudents, student];
      newUnassignedList.sort((a, b) => a.student_name.localeCompare(b.student_name, 'ko'));
      
      setUnassignedStudents(newUnassignedList);
      setAssignedStudents(newAssignedStudents);
      
    } catch (error) {
      console.error('학생 미배치 처리 오류:', error);
      toast({
        title: '학생 미배치 처리 실패',
        description: '서버 오류가 발생했습니다. 다시 시도해주세요.',
        status: 'error',
        duration: 1000,
        isClosable: true,
      });
    }
  };

  // 다중 학생 미배치 처리 함수
  const handleUnassignMultipleStudents = async (students: Student[]) => {
    try {
      // 모든 학생에 대해 API 호출
      await Promise.all(students.map(student => unassignStudent(student.id)));
      
      // 상태 업데이트
      const studentIds = students.map(s => s.id);
      
      // 모든 선생님에게서 해당 학생들 제거
      const newAssignedStudents = { ...assignedStudents };
      Object.keys(newAssignedStudents).forEach(key => {
        const teacherId = Number(key);
        newAssignedStudents[teacherId] = newAssignedStudents[teacherId].filter(s => !studentIds.includes(s.id));
      });
      
      // 미배치 학생 목록에 추가 (이름순으로 정렬)
      const newUnassignedList = [...unassignedStudents, ...students];
      newUnassignedList.sort((a, b) => a.student_name.localeCompare(b.student_name, 'ko'));
      
      setUnassignedStudents(newUnassignedList);
      setAssignedStudents(newAssignedStudents);
      
    } catch (error) {
      console.error('다중 학생 미배치 처리 오류:', error);
      toast({
        title: '학생 미배치 처리 실패',
        description: '서버 오류가 발생했습니다. 다시 시도해주세요.',
        status: 'error',
        duration: 1000,
        isClosable: true,
      });
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <Container maxW="100%" p={4} pt="75px" h="100vh" display="flex" flexDirection="column">
        <Flex h="calc(100vh - 90px)" gap={6}>
          {/* 미배치 학생 목록 (왼쪽) */}
          <Box 
            flex="4" 
            border="1px solid" 
            borderColor="#d6d6d6" 
            borderRadius="lg"
            display="flex"
            flexDirection="column"
            overflow="hidden"
          >
            <UnassignedStudentArea 
              students={unassignedStudents} 
              onUnassignStudent={handleUnassignStudent}
              onUnassignMultipleStudents={handleUnassignMultipleStudents}
              onRefresh={fetchData}
              clearSelectionRef={clearSelectionRef}
            />
          </Box>
          
          {/* 선생님 박스 영역 (오른쪽) */}
          <Box flex="6" borderRadius="lg" overflow="hidden">
            <Grid 
              templateColumns="repeat(2, 1fr)" 
              gap={4} 
              h="100%" 
              overflowY="auto"
              p={1}
            >
              {teachers.map(teacher => (
                <GridItem key={teacher.id}>
                  <TeacherBox 
                    teacher={teacher} 
                    students={assignedStudents[teacher.id] || []} 
                    onAssignStudent={handleAssignStudent}
                    onAssignMultipleStudents={handleAssignMultipleStudents}
                    onUnassignStudent={handleUnassignStudent}
                    onUnassignMultipleStudents={handleUnassignMultipleStudents}
                    onClearSelection={() => clearSelectionRef.current?.()}
                  />
                </GridItem>
              ))}
            </Grid>
          </Box>
        </Flex>
      </Container>
    </DndProvider>
  );
}

// AuthGuard로 감싸서 관리자 권한만 접근 가능하도록 설정
export default function StudentPlacementPage() {
  return (
    <AuthGuard allowedRoles={['admin']}>
      <StudentPlacementPageContent />
    </AuthGuard>
  );
} 