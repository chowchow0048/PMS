'use client';

import { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Box, Flex, Container, Heading, Grid, GridItem, Spinner, Center, useToast, useDisclosure } from '@chakra-ui/react';
import UnassignedStudentArea from '@/components/student-placement/UnassignedStudentArea';
import ClinicDayBox from '@/components/student-placement/ClinicDayBox';
import ClinicManagementModal from '@/components/student-placement/ClinicManagementModal';
import { Student, User, Clinic, DAY_CHOICES } from '@/lib/types'; // types.ts에서 import
import { Time } from '@/components/student-placement/StudentItem'; // Time은 StudentItem에서 import
import { getStudents, getTeachers, getClinics, assignStudent, unassignStudent, assignStudentToClinic } from '@/lib/api';
import { AuthGuard } from '@/lib/authGuard';

// Teacher 타입을 User 기반으로 정의 (is_teacher=true인 User)
type Teacher = User & {
  is_teacher: true;
  user_name: string; // name과 동일하지만 기존 코드 호환성을 위해
  user_subject: any; // subject와 동일
  max_student_num: number; // 기본값 설정 필요
};

// 학생 배치 페이지 컴포넌트 (관리자 전용)
function StudentPlacementPageContent() {
  // 상태 관리
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<Record<number, Student[]>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // 선택 해제 함수를 위한 ref
  const clearSelectionRef = useRef<(() => void) | null>(null);

  // 클리닉 데이터 업데이트 함수 (낙관적 업데이트용)
  const updateClinicData = (clinicId: number, studentId: number, isAdd: boolean) => {
    console.log('🔍 [student-placement/page.tsx] 클리닉 데이터 업데이트:', { clinicId, studentId, isAdd });
    
    setClinics(prevClinics => {
      return prevClinics.map(clinic => {
        if (clinic.id === clinicId) {
          const updatedClinic = { ...clinic };
          
          if (isAdd) {
            // 학생 추가 - 중복 체크
            const isAlreadyExists = updatedClinic.clinic_students?.some(s => s.id === studentId);
            if (!isAlreadyExists) {
              // 학생 정보를 찾아서 추가 (unassignedStudents에서 검색)
              const studentToAdd = unassignedStudents.find(s => s.id === studentId);
              if (studentToAdd) {
                updatedClinic.clinic_students = [
                  ...(updatedClinic.clinic_students || []),
                  {
                    id: studentToAdd.id,
                    name: studentToAdd.student_name,
                    username: studentToAdd.username || studentToAdd.student_name,
                    is_student: true,
                    is_teacher: false,
                    is_staff: false,
                    is_superuser: false,
                    is_active: true,
                    student_parent_phone_num: studentToAdd.student_parent_phone_num || '',
                    student_phone_num: studentToAdd.student_phone_num || '',
                    school: studentToAdd.school || '',
                    grade: studentToAdd.grade || '',
                    subject: studentToAdd.subject,
                  } as User
                ];
              }
            }
          } else {
            // 학생 제거
            updatedClinic.clinic_students = (updatedClinic.clinic_students || []).filter(
              s => s.id !== studentId
            );
          }
          
          console.log('✅ [student-placement/page.tsx] 클리닉 업데이트 완료:', {
            clinicId,
            studentCount: updatedClinic.clinic_students?.length || 0
          });
          
          return updatedClinic;
        }
        return clinic;
      });
    });
  };

  // 학생의 non_pass 상태 업데이트 함수 (의무 클리닉 대상자 뱃지 제거용)
  const updateStudentNonPassStatus = (studentId: number, nonPass: boolean) => {
    console.log('🔍 [student-placement/page.tsx] 학생 non_pass 상태 업데이트:', { studentId, nonPass });
    
    setUnassignedStudents(prevStudents => {
      return prevStudents.map(student => {
        if (student.id === studentId) {
          const updatedStudent = { ...student, non_pass: nonPass };
          console.log('✅ [student-placement/page.tsx] 학생 non_pass 상태 업데이트 완료:', {
            studentId,
            name: student.student_name,
            oldNonPass: student.non_pass,
            newNonPass: nonPass
          });
          return updatedStudent;
        }
        return student;
      });
    });
  };

  // 초기 데이터 로딩
  useEffect(() => {
    fetchData();
  }, []);

  // 데이터 로딩 함수
  const fetchData = async () => {
    try {
      // console.log('🔍 [student-placement/page.tsx] fetchData 함수 시작');
      setLoading(true);
      
      // 학생, 선생님, 클리닉 데이터 동시 로딩
      const [studentsData, teachersData, clinicsData] = await Promise.all([
        getStudents(),
        getTeachers(),
        getClinics()
      ]);

      // console.log('🔍 [student-placement/page.tsx] 클리닉 데이터 로딩 완료:', clinicsData);
      
      // 데이터 처리
      const teachersArray = Array.isArray(teachersData) ? teachersData : [];
      const studentsArray = Array.isArray(studentsData) ? studentsData : [];
      const clinicsArray = Array.isArray(clinicsData) ? clinicsData : [];
      
      setTeachers(teachersArray);
      setClinics(clinicsArray);
      
      // 클리닉 시스템으로 변경: 모든 학생을 미배치 목록에 유지
      // (학생은 여러 요일에 배치될 수 있으므로 미배치 목록에서 제거하지 않음)
      const unassigned: Student[] = [...studentsArray];
      const assigned: Record<number, Student[]> = {};
      
      // 선생님별 학생 배열 초기화 (기존 코드 호환성을 위해 유지)
      teachersArray.forEach((teacher: Teacher) => {
        assigned[teacher.id] = [];
      });
      
      setUnassignedStudents(unassigned);
      setAssignedStudents(assigned);
      
      // console.log('🔍 [student-placement/page.tsx] 모든 데이터 로딩 완료');
    } catch (error) {
      // console.error('❌ [student-placement/page.tsx] fetchData에서 오류 발생:', error);
      
      toast({
        title: '데이터 로딩 실패',
        description: '서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인하세요.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 클리닉 클릭 처리 (요일별로 변경)
  const handleClinicClick = (day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun') => {
    // 더미 클리닉 설정 (모달에서 요일 정보 전달용)
    setSelectedClinic({ id: 0, clinic_day: day } as Clinic);
    onOpen();
  };

  // 클리닉 업데이트 처리
  const handleClinicUpdate = (updatedClinic: Clinic) => {
    setClinics(prev => prev.map(clinic => 
      clinic.id === updatedClinic.id ? updatedClinic : clinic
    ));
  };

  // 데이터 로딩 중일 때 로딩 표시
  if (loading) {
    return (
      <Center h="calc(100vh - 100px)" w="100%">
        <Spinner size="xl" color="blue.500" thickness="4px" />
      </Center>
    );
  }
  
  // 임시 더미 함수 (기존 코드 호환성을 위해)
  const handleAssignStudent = async (studentId: number, teacherId: number) => {
    console.warn('handleAssignStudent: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
    toast({ 
      title: '기능 중단',
      description: '보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.',
      status: 'warning',
      duration: 3000,
      isClosable: true,
    });
  };
  // 임시 더미 함수 (기존 코드 호환성을 위해)
  const handleAssignMultipleStudents = async (students: Student[], teacherId: number) => {
    console.warn('handleAssignMultipleStudents: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
    toast({ 
      title: '기능 중단',
      description: '보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.',
      status: 'warning',
      duration: 3000,
      isClosable: true,
    });
  };
  
  // 임시 더미 함수 (기존 코드 호환성을 위해)
  const handleUnassignStudent = async (studentId: number) => {
    console.warn('handleUnassignStudent: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
    toast({
      title: '기능 중단',
      description: '보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.',
      status: 'warning',
      duration: 3000,
      isClosable: true,
    });
  };
  
  // 임시 더미 함수 (기존 코드 호환성을 위해)
  const handleUnassignMultipleStudents = async (students: Student[]) => {
    console.warn('handleUnassignMultipleStudents: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
    toast({
      title: '기능 중단',
      description: '보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.',
      status: 'warning',
      duration: 3000,
      isClosable: true,
    });
  };

  // 학생이 특정 요일에 이미 배치되어 있는지 확인하는 함수
  const isStudentAlreadyAssignedToDay = (studentId: number, day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'): boolean => {
    const targetClinic = clinics.find(clinic => clinic.clinic_day === day);
    if (!targetClinic) return false;
    
    // 해당 요일 클리닉의 모든 학생 목록에서 확인 (통합된 보충수업)
    const allStudentsInClinic = targetClinic.clinic_students?.map(user => user.id) || [];
    
    return allStudentsInClinic.includes(studentId);
  };

  // 클리닉에 학생 배치 처리 함수
  const handleStudentDropToClinic = async (day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', students: Student[]) => {
    try {
      // console.log('🔍 [student-placement/page.tsx] 클리닉 배치 시도:', day, students);
      
      // 해당 요일의 클리닉 찾기
      const targetClinic = clinics.find(clinic => clinic.clinic_day === day);
      if (!targetClinic) {
        toast({
          title: '클리닉 없음',
          description: `${DAY_CHOICES.find(d => d.value === day)?.label} 클리닉이 존재하지 않습니다.`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      // 이미 배치된 학생이 있는지 확인
      const alreadyAssignedStudents = students.filter(student => 
        isStudentAlreadyAssignedToDay(student.id, day)
      );
      
      if (alreadyAssignedStudents.length > 0) {
        const dayLabel = DAY_CHOICES.find(d => d.value === day)?.label;
        const studentNames = alreadyAssignedStudents.map(s => s.student_name).join(', ');
        const message = alreadyAssignedStudents.length === 1 
          ? `${studentNames} 학생은 이미 ${dayLabel} 클리닉에 배치되어 있습니다.`
          : `${studentNames} 등 ${alreadyAssignedStudents.length}명은 이미 ${dayLabel} 클리닉에 배치되어 있습니다.`;
        
        toast({
          title: '중복 배치 불가',
          description: message,
          status: 'warning',
          duration: 4000,
          isClosable: true,
        });
        return;
      }
      
      // 학생 ID 배열 생성
      const studentIds = students.map(student => student.id);
      
      // API 호출로 클리닉에 학생 배치
      const updatedClinic = await assignStudentToClinic(targetClinic.id, studentIds);
      
      // 상태 업데이트 (미배치 학생 목록에서는 제거하지 않음)
      setClinics(prev => prev.map(clinic => 
        clinic.id === updatedClinic.id ? updatedClinic : clinic
      ));
      
      // 성공 메시지 표시
      const dayLabel = DAY_CHOICES.find(d => d.value === day)?.label;
      const studentNames = students.map(s => s.student_name).join(', ');
      const message = students.length === 1 
        ? `${studentNames} 학생을 ${dayLabel} 클리닉에 배치했습니다.`
        : `${studentNames} 등 ${students.length}명을 ${dayLabel} 클리닉에 배치했습니다.`;
      
      toast({
        title: '학생 배치 성공',
        description: message,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
    } catch (error) {
      console.error('❌ [student-placement/page.tsx] 클리닉 배치 오류:', error);
      toast({
        title: '배치 실패',
        description: '학생 배치 중 오류가 발생했습니다. 다시 시도해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <Container maxW="100%" p={4} h="100vh" display="flex" flexDirection="column">
        <Flex h="calc(100vh)" gap={6}>
          {/* 학생 목록 (왼쪽) */}
          <Box 
            flex="5" 
            marginBottom={4}
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
              onStudentClick={setSelectedStudent}
              onClinicDataUpdate={updateClinicData}
              onUpdateStudentNonPass={updateStudentNonPassStatus}
            />
          </Box>
          
          {/* 클리닉 데이 박스 영역 (오른쪽) */}
          <Box flex="5" borderRadius="lg" overflow="hidden">
            <Grid 
              templateColumns="repeat(auto-fit, minmax(300px, 1fr))"
              gap={4} 
              h="100%" 
              overflowY="auto"
              p={1}
            >
              {DAY_CHOICES.map(({ value, label }) => (
                <GridItem key={value}>
                  <ClinicDayBox
                    day={value}
                    dayLabel={label}
                    clinics={clinics}
                    onClinicClick={handleClinicClick}
                    onStudentDrop={handleStudentDropToClinic}
                    isStudentAlreadyAssigned={isStudentAlreadyAssignedToDay}
                  />
                </GridItem>
              ))}
            </Grid>
          </Box>
        </Flex>

        {/* 클리닉 관리 모달 */}
        <ClinicManagementModal
          isOpen={isOpen}
          onClose={onClose}
          day={selectedClinic?.clinic_day || null}
          clinics={clinics}
          onUpdate={handleClinicUpdate}
        />
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