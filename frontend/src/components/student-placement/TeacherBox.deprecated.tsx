// 'use client';

// import { FC, useState, useRef, useEffect } from 'react';
// import { 
//   Box, 
//   Text, 
//   VStack, 
//   Heading, 
//   Modal,
//   ModalOverlay,
//   ModalContent,
//   ModalHeader,
//   ModalBody,
//   ModalFooter,
//   ModalCloseButton,
//   useDisclosure,
//   SimpleGrid,
//   Divider,
//   Button,
//   useToast,
//   HStack,
//   AlertDialog,
//   AlertDialogBody,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogContent,
//   AlertDialogOverlay
// } from '@chakra-ui/react';
// import { useDrop } from 'react-dnd';
// import { Student, ItemTypes, Time } from './StudentItem';

// // 선생님 객체 인터페이스 정의
// export interface Teacher {
//   id: number;
//   user_name: string;
//   available_time?: number[]; // 가능한 시간 ID 배열
//   available_time_details?: Time[]; // 가능한 시간 상세 정보
//   max_student_num?: number; // 최대 배치 학생 수
// }

// // 선생님 박스 컴포넌트 props 인터페이스
// interface TeacherBoxProps {
//   teacher: Teacher;
//   students: Student[];
//   onAssignStudent: (studentId: number, teacherId: number) => void;
//   onAssignMultipleStudents?: (students: Student[], teacherId: number) => void;
//   onUnassignStudent: (studentId: number) => void;
//   onUnassignMultipleStudents?: (students: Student[]) => void;
//   onClearSelection?: () => void;
//   selectedStudent?: Student | null; // 선택된 학생 정보
//   onTeacherUpdate?: () => void; // 선생님 정보 업데이트 콜백
// }

// // 영향받는 학생 정보 인터페이스
// interface AffectedStudent {
//   id: number;
//   student_name: string;
//   school: string;
//   grade: string;
// }

// // 취소된 클리닉 정보 인터페이스
// interface CancelledClinic {
//   id: number;
//   clinic_time: string;
// }

// // 학생 표시용 컴포넌트 (드래그 불가능)
// const StudentDisplayItem: FC<{ student: Student }> = ({ student }) => {
//   return (
//     <Box
//       p={2}
//       borderRadius="md"
//       bg="white"
//       border="1px solid"
//       borderColor="gray.200"
//       textAlign="center"
//       width="100%"
//       boxSizing="border-box"
//     >
//       <Text 
//         fontWeight="medium" 
//         fontSize="sm" 
//         color="gray.700"
//         mb={1}
//       >
//         {student.student_name}
//       </Text>
//       <Text 
//         fontSize="xs" 
//         color="gray.500"
//       >
//         [{student.school}] [{student.grade}]
//       </Text>
//     </Box>
//   );
// };

// // 선생님 박스 컴포넌트
// const TeacherBox: FC<TeacherBoxProps> = ({ 
//   teacher, 
//   students, 
//   onAssignStudent,
//   onAssignMultipleStudents,
//   onUnassignStudent,
//   onUnassignMultipleStudents,
//   onClearSelection,
//   selectedStudent,
//   onTeacherUpdate
// }) => {
//   // 모달 관련 상태
//   const { isOpen, onOpen, onClose } = useDisclosure();
  
//   // 시간표 편집 관련 상태
//   const [isEditingSchedule, setIsEditingSchedule] = useState(false); // 시간표 편집 모드
//   const [tempAvailableTimes, setTempAvailableTimes] = useState<number[]>([]); // 임시 시간표 상태
//   const [isLoading, setIsLoading] = useState(false); // 저장 중 로딩 상태
//   const [allTimeObjects, setAllTimeObjects] = useState<Time[]>([]); // 모든 Time 객체
  
//   // 확인 다이얼로그 관련 상태
//   const [isConfirmOpen, setIsConfirmOpen] = useState(false);
//   const [affectedStudents, setAffectedStudents] = useState<AffectedStudent[]>([]);
//   const [cancelledClinics, setCancelledClinics] = useState<CancelledClinic[]>([]);
//   const cancelRef = useRef<HTMLButtonElement>(null);
  
//   // 드롭 이벤트 발생 여부를 추적하는 상태
//   const [isDropEvent, setIsDropEvent] = useState(false);

//   // 토스트 훅 추가
//   const toast = useToast();

//   // 요일 배열
//   const days = ['월', '화', '수', '목', '금', '토', '일'];
  
//   // 시간 배열 (10:00 ~ 20:00)
//   const times = Array.from({ length: 11 }, (_, i) => `${i + 10}:00`);

//   // 모든 Time 객체 로드 함수
//   const fetchAllTimes = async () => {
//     try {
//       // console.log('Time 객체 로드 시작...');
//       const token = localStorage.getItem('token');
//       // console.log('Token 존재 여부:', !!token);
//       // console.log('Token 값:', token ? `${token.substring(0, 10)}...` : 'null');
      
//       const response = await fetch('http://localhost:8000/api/times/', {
//         headers: {
//           'Authorization': `Token ${token}`,
//           'Content-Type': 'application/json'
//         }
//       });
      
//       // console.log('Times API 응답 상태:', response.status, response.statusText);
      
//       if (response.ok) {
//         const timesData = await response.json();
//         // console.log('Times API 원본 응답:', timesData);
        
//         // pagination된 응답에서 results 배열 추출
//         const timeObjects = timesData.results || (Array.isArray(timesData) ? timesData : []);
//         // console.log('처리된 Time 객체들:', timeObjects);
//         // console.log('Time 객체 개수:', timeObjects.length);
        
//         // if (timeObjects.length > 0) {
//         //   console.log('첫 번째 Time 객체 샘플:', timeObjects[0]);
//         // }
        
//         setAllTimeObjects(timeObjects);
//       } else {
//         const errorText = await response.text();
//         console.error('Times API 오류 응답:', response.status, errorText);
//       }
//     } catch (error) {
//       console.error('시간 데이터 로드 오류:', error);
//       if (error instanceof Error) {
//         console.error('에러 상세:', error.message, error.stack);
//       }
//     }
//   };

//   // 모달이 열릴 때 Time 객체 로드
//   useEffect(() => {
//     // console.log('useEffect 실행됨 - isOpen:', isOpen, 'allTimeObjects.length:', allTimeObjects.length);
//     if (isOpen && allTimeObjects.length === 0) {
//       // console.log('모달 열림 - Time 객체 로드 시작');
//       fetchAllTimes();
//     }
//   }, [isOpen]);

//   // allTimeObjects 변경 시 로그 출력
//   // useEffect(() => {
//   //   console.log('allTimeObjects 상태 변경:', allTimeObjects.length, allTimeObjects);
//   // }, [allTimeObjects]);

//   // 모든 시간 객체를 ID와 함께 매핑하기 위한 배열 생성
//   const allTimeSlots = days.flatMap(day => 
//     times.map(time => {
//       const dayMap: { [key: string]: string } = {
//         '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', 
//         '금': 'fri', '토': 'sat', '일': 'sun'
//       };
      
//       const englishDay = dayMap[day];
//       const timeWithSeconds = `${time}:00`;
      
//       // 모든 Time 객체에서 해당하는 시간의 ID 찾기
//       const timeObject = allTimeObjects.find(
//         timeObj => {
//           // time_slot이 문자열인지 확인하고 비교
//           const timeSlot = timeObj.time_slot;
//           const isMatch = timeObj.time_day === englishDay && 
//                          (timeSlot === timeWithSeconds || timeSlot === time);
//           return isMatch;
//         }
//       );
      
//               // 디버깅: 특정 시간에 대해 매칭 결과 확인
//         // if (day === '월' && time === '10:00') {
//         //   console.log('월요일 10:00 매칭 시도:');
//         //   console.log('찾는 조건:', { englishDay, timeWithSeconds, time });
//         //   console.log('매칭된 객체:', timeObject);
//         //   
//         //   const mondayObjects = allTimeObjects.filter(obj => obj.time_day === 'mon');
//         //   console.log('모든 월요일 객체:', mondayObjects);
//         //   
//         //   console.log('월요일 객체들의 time_slot 상세:');
//         //   mondayObjects.forEach(obj => {
//         //     console.log(`ID: ${obj.id}, time_slot: "${obj.time_slot}", type: ${typeof obj.time_slot}`);
//         //     console.log(`비교: "${obj.time_slot}" === "${timeWithSeconds}" ? ${obj.time_slot === timeWithSeconds}`);
//         //     console.log(`비교: "${obj.time_slot}" === "${time}" ? ${obj.time_slot === time}`);
//         //   });
//         // }
      
//       return {
//         day,
//         time,
//         englishDay,
//         timeWithSeconds,
//         id: timeObject?.id || null
//       };
//     })
//   );

//   // 해당 시간이 선생의 available_time에 포함되는지 확인
//   const isTimeAvailable = (day: string, time: string) => {
//     if (isEditingSchedule) {
//       // 편집 모드일 때는 임시 상태 확인
//       const timeInfo = getTimeInfo(day, time);
//       return timeInfo?.id ? tempAvailableTimes.includes(timeInfo.id) : false;
//     } else {
//       // 일반 모드일 때는 기존 로직 사용
//       if (!teacher?.available_time_details) return false;
      
//       const dayMap: { [key: string]: string } = {
//         '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu',
//         '금': 'fri', '토': 'sat', '일': 'sun'
//       };
      
//       const englishDay = dayMap[day];
//       if (!englishDay) return false;
      
//       const timeWithSeconds = `${time}:00`;
      
//       return teacher.available_time_details.some(
//         availableTime => 
//           availableTime.time_day === englishDay && 
//           availableTime.time_slot === timeWithSeconds
//       );
//     }
//   };

//   // 특정 요일과 시간에 대한 정보를 가져오는 함수
//   const getTimeInfo = (day: string, time: string) => {
//     return allTimeSlots.find(slot => slot.day === day && slot.time === time);
//   };

//   // 시간표 편집 시작
//   const handleStartEditing = () => {
//     setIsEditingSchedule(true);
//     // 현재 available_time을 임시 상태에 복사
//     setTempAvailableTimes([...(teacher.available_time || [])]);
//   };

//   // 시간표 편집 취소
//   const handleCancelEditing = () => {
//     setIsEditingSchedule(false);
//     setTempAvailableTimes([]);
//   };

//   // 시간 셀 클릭 핸들러 (편집 모드에서만 작동)
//   const handleTimeSlotClick = (day: string, time: string) => {
//     if (!isEditingSchedule) return;
    
//     const timeInfo = getTimeInfo(day, time);
//     if (!timeInfo?.id) {
//       // console.log('Time ID를 찾을 수 없습니다:', day, time, timeInfo);
//       return;
//     }
    
//     // console.log('시간 셀 클릭:', day, time, 'ID:', timeInfo.id);
    
//     setTempAvailableTimes(prev => {
//       const newTimes = prev.includes(timeInfo.id!) 
//         ? prev.filter(id => id !== timeInfo.id) // 제거
//         : [...prev, timeInfo.id!]; // 추가
      
//       // console.log('임시 시간표 업데이트:', prev, '->', newTimes);
//       return newTimes;
//     });
//   };

//   // 시간표 저장 (무결성 검사 포함)
//   const handleSaveSchedule = async () => {
//     setIsLoading(true);
    
//     try {
//       // console.log('시간표 저장 시작:', tempAvailableTimes);
      
//       // API 호출하여 시간표 업데이트 및 무결성 검사
//       const response = await fetch(`http://localhost:8000/api/teachers/${teacher.id}/available-time/`, {
//         method: 'PATCH',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Token ${localStorage.getItem('token')}`
//         },
//         body: JSON.stringify({
//           available_time_ids: tempAvailableTimes
//         })
//       });

//       // console.log('API 응답 상태:', response.status);

//       if (!response.ok) {
//         const responseText = await response.text();
//         // console.log('API 응답 내용:', responseText);
        
//         let errorMessage = '시간표 업데이트에 실패했습니다.';
//         try {
//           const errorData = JSON.parse(responseText);
//           errorMessage = errorData.error || errorMessage;
//         } catch (e) {
//           // JSON 파싱 실패 시 원본 텍스트 사용
//           errorMessage = `서버 오류 (${response.status}): ${responseText.substring(0, 100)}`;
//         }
        
//         throw new Error(errorMessage);
//       }

//       const result = await response.json();
//       // console.log('API 응답 결과:', result);
      
//       // 영향받는 학생이나 취소된 클리닉이 있는 경우 확인 다이얼로그 표시
//       if (result.affected_students.length > 0 || result.cancelled_clinics.length > 0) {
//         setAffectedStudents(result.affected_students);
//         setCancelledClinics(result.cancelled_clinics);
//         setIsConfirmOpen(true);
//       } else {
//         // 영향받는 것이 없으면 바로 완료
//         completeScheduleUpdate();
//       }
      
//     } catch (error) {
//       console.error('시간표 업데이트 오류:', error);
//       toast({
//         title: '시간표 업데이트 실패',
//         description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
//         status: 'error',
//         duration: 5000,
//         isClosable: true,
//       });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // 시간표 업데이트 완료
//   const completeScheduleUpdate = () => {
//     setIsEditingSchedule(false);
//     setTempAvailableTimes([]);
//     setIsConfirmOpen(false);
//     setAffectedStudents([]);
//     setCancelledClinics([]);
    
//     toast({
//       title: '시간표 업데이트 완료',
//       description: '선생님의 수업 가능 시간표가 성공적으로 업데이트되었습니다.',
//       status: 'success',
//       duration: 3000,
//       isClosable: true,
//     });
    
//     // 부모 컴포넌트에 업데이트 알림
//     if (onTeacherUpdate) {
//       onTeacherUpdate();
//     }
    
//     // 모달 닫기
//     onClose();
//   };

//   // 하이라이트 상태 계산 함수
//   const getHighlightType = (): 'compatible' | 'expected_compatible' | 'expected_incompatible' | 'none' => {
//     if (!selectedStudent) return 'none';

//     // 학생의 가능한 시간 ID 배열
//     const studentAvailableTimes = selectedStudent.available_time || [];
//     // 선생님의 가능한 시간 ID 배열
//     const teacherAvailableTimes = teacher.available_time || [];

//     // 공통 시간 계산
//     const commonTimes = studentAvailableTimes.filter(timeId => 
//       teacherAvailableTimes.includes(timeId)
//     );

//     // 희망 선생님인지 확인 (여러 선생님 지원)
//     const expectedTeacher = selectedStudent.expected_teacher;
//     let isTeacherExpected = false;
    
//     if (expectedTeacher && expectedTeacher.trim() !== '') {
//       // 쉼표로 구분된 여러 선생님 이름 처리
//       const expectedTeachers = expectedTeacher
//         .split(',')
//         .map(name => name.trim())
//         .filter(name => name !== '');
      
//       // 현재 선생님이 희망 선생님 목록에 포함되는지 확인
//       isTeacherExpected = expectedTeachers.includes(teacher.user_name);
//     }

//     if (isTeacherExpected) {
//       // 희망 선생님이면서 매칭되는 시간이 있는 경우 -> 초록색
//       if (commonTimes.length > 0) {
//         return 'expected_compatible';
//       } else {
//         // 희망 선생님이지만 매칭되는 시간이 없는 경우 -> 보라색
//         return 'expected_incompatible';
//       }
//     } else {
//       // 희망 선생님이 아니지만 최소 2시간 이상 매칭되는 경우 -> 노란색
//       if (commonTimes.length >= 2) {
//         return 'compatible';
//       }
//     }

//     return 'none';
//   };

//   const highlightType = getHighlightType();

//   // 시간대 매칭 검증 함수
//   const validateTimeMatch = (student: Student): boolean => {
//     const studentAvailableTimes = student.available_time || [];
//     const teacherAvailableTimes = teacher.available_time || [];

//     // 공통 시간 계산
//     const commonTimes = studentAvailableTimes.filter(timeId => 
//       teacherAvailableTimes.includes(timeId)
//     );

//     // 최소 1개 이상의 공통 시간이 있어야 배치 가능
//     return commonTimes.length > 0;
//   };

//   // 드롭 기능 구현
//   const [{ isOver }, dropRef] = useDrop({
//     accept: ItemTypes.STUDENT,
//     drop: (item: { 
//       id: number; 
//       student: Student; 
//       selectedStudents?: Student[]; 
//       isMultiple?: boolean; 
//     }) => {
//       // 드롭 이벤트 발생 플래그 설정
//       setIsDropEvent(true);
      
//       // 시간대 매칭 검증
//       let studentsToValidate: Student[] = [];
//       if (item.isMultiple && item.selectedStudents) {
//         studentsToValidate = item.selectedStudents;
//       } else {
//         studentsToValidate = [item.student];
//       }

//       // 모든 학생의 시간대 매칭 검증
//       const invalidStudents = studentsToValidate.filter(student => !validateTimeMatch(student));
      
//       if (invalidStudents.length > 0) {
//         // 매칭이 불가능한 학생이 있는 경우
//         const studentNames = invalidStudents.map(s => s.student_name).join(', ');
//         toast({
//           title: '매칭이 불가능합니다',
//           description: `${studentNames}: 시간대가 맞지않음`,
//           status: 'error',
//           duration: 3000,
//           isClosable: true,
//         });
        
//         // 드롭 이벤트 플래그 초기화
//         setTimeout(() => setIsDropEvent(false), 100);
        
//         // 배치 실패를 나타내는 객체 반환 (학생이 원래 위치로 돌아감)
//         return { rejected: true };
//       }
      
//       // 모든 학생이 매칭 가능한 경우에만 배치 진행
//       if (item.isMultiple && item.selectedStudents && onAssignMultipleStudents) {
//         // 다중 학생 배치 함수 사용
//         onAssignMultipleStudents(item.selectedStudents, teacher.id);
//       } else {
//         // 단일 학생 배치
//         onAssignStudent(item.id, teacher.id);
//       }
      
//       // 드래그 완료 후 선택 해제
//       if (onClearSelection) {
//         onClearSelection();
//       }
      
//       // 드롭 이벤트 플래그 초기화 (약간의 지연 후)
//       setTimeout(() => setIsDropEvent(false), 100);
      
//       return { teacherId: teacher.id };
//     },
//     collect: (monitor) => ({
//       isOver: !!monitor.isOver(),
//     }),
//   });

//   // 박스 클릭 핸들러 (드롭 이벤트가 아닐 때만 모달 열기)
//   const handleBoxClick = () => {
//     if (!isDropEvent) {
//       onOpen();
//     }
//   };

//   // 모달에서 학생 클릭 핸들러 (배치 해제)
//   const handleModalStudentClick = (student: Student) => {
//     onUnassignStudent(student.id);
//   };

//   // 배치 초기화 핸들러
//   const handleClearAllStudents = () => {
//     if (students.length > 0 && onUnassignMultipleStudents) {
//       onUnassignMultipleStudents(students);
//     }
//           onClose();
//   };

//   // 하이라이트 타입에 따른 스타일 계산
//   const getBoxStyles = () => {
//     if (isOver) {
//       return {
//         bg: 'blue.50',
//         borderColor: 'blue.400',
//         borderWidth: '3px',
//         boxShadow: '0 0 20px rgba(66, 153, 225, 0.6), 0 4px 15px rgba(0, 0, 0, 0.1)'
//       };
//     }

//     switch (highlightType) {
//       case 'expected_compatible':
//         return {
//           bg: 'green.50',
//           borderColor: 'green.400',
//           borderWidth: '3px',
//           boxShadow: '0 0 25px rgba(72, 187, 120, 0.7), 0 4px 20px rgba(0, 0, 0, 0.15)'
//         };
//       case 'expected_incompatible':
//         return {
//           bg: 'purple.50',
//           borderColor: 'purple.400',
//           borderWidth: '3px',
//           boxShadow: '0 0 25px rgba(159, 122, 234, 0.7), 0 4px 20px rgba(0, 0, 0, 0.15)'
//         };
//       case 'compatible':
//         return {
//           bg: 'yellow.50',
//           borderColor: 'yellow.400',
//           borderWidth: '3px',
//           boxShadow: '0 0 25px rgba(236, 201, 75, 0.8), 0 4px 20px rgba(0, 0, 0, 0.15)'
//         };
//       default:
//         return {
//           bg: 'white',
//           borderColor: 'gray.300',
//           borderWidth: '1px',
//           boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
//         };
//     }
//   };

//   const boxStyles = getBoxStyles();

//   return (
//     <>
//       <Box
//         ref={dropRef as any}
//         p={3}
//         bg={boxStyles.bg}
//         borderRadius="md"
//         border={boxStyles.borderWidth}
//         borderStyle="solid"
//         borderColor={boxStyles.borderColor}
//         width="100%"
//         height="350px"
//         boxShadow={boxStyles.boxShadow}
//         display="flex"
//         flexDirection="column"
//         cursor="pointer"
//         onClick={handleBoxClick}
//         _hover={{
//           borderColor: highlightType !== 'none' ? boxStyles.borderColor : 'blue.400',
//           transform: highlightType !== 'none' ? 'translateY(-2px)' : 'none'
//         }}
//         transition="all 0.5s ease-in-out"
//         transform={highlightType !== 'none' ? 'scale(1.02)' : 'scale(1)'}
//       >
//         <Box mb={3} pb={2} borderBottom="1px solid" borderColor="gray.200" flexShrink={0}>
//           <Heading 
//             as="h3" 
//             size="md" 
//             mb={2}
//             color={
//               highlightType === 'expected_compatible' ? 'green.700' :
//               highlightType === 'expected_incompatible' ? 'purple.700' :
//               highlightType === 'compatible' ? 'yellow.700' :
//               'gray.800'
//             }
//             fontWeight={highlightType !== 'none' ? 'bold' : 'semibold'}
//             textShadow={
//               highlightType === 'expected_compatible' ? '0 0 8px rgba(72, 187, 120, 0.3)' :
//               highlightType === 'expected_incompatible' ? '0 0 8px rgba(159, 122, 234, 0.3)' :
//               highlightType === 'compatible' ? '0 0 8px rgba(236, 201, 75, 0.3)' :
//               'none'
//             }
//             transition="all 0.5s ease-in-out"
//           >
//             {teacher.user_name}
//           </Heading>
          
//           <Text 
//             fontSize="sm" 
//             color={
//               highlightType === 'expected_compatible' ? 'green.600' :
//               highlightType === 'expected_incompatible' ? 'purple.600' :
//               highlightType === 'compatible' ? 'yellow.600' :
//               'gray.600'
//             }
//             fontWeight={highlightType !== 'none' ? 'semibold' : 'normal'}
//             transition="all 0.5s ease-in-out"
//           >
//             배치된 학생: {students.length}명 / 최대 배치 학생: {teacher.max_student_num}명
//           </Text>
//         </Box>
        
//         <Box overflowY="auto" flex={1}>
//           {students.length > 0 ? (
//             <SimpleGrid columns={2} spacing={2}>
//               {students
//                 .slice()
//                 .sort((a, b) => a.student_name.localeCompare(b.student_name, 'ko'))
//                 .map(student => (
//                   <StudentDisplayItem 
//                     key={student.id} 
//                     student={student} 
//                   />
//                 ))}
//             </SimpleGrid>
//           ) : (
//             <Box 
//               display="flex" 
//               alignItems="center" 
//               justifyContent="center" 
//               height="100%"
//             >
//               <Text fontSize="sm" color="gray.500" textAlign="center">
//                 배치된 학생이 없습니다
//               </Text>
//             </Box>
//           )}
//         </Box>
//       </Box>

//       {/* 선생님 관리 모달 */}
//       <Modal isOpen={isOpen} onClose={onClose} size="6xl" isCentered>
//         <ModalOverlay />
//         <ModalContent maxW="1200px" height="80vh" display="flex" flexDirection="column">
//           <ModalHeader pb={1}>
//             {teacher.user_name}
//           </ModalHeader>
//           <ModalCloseButton />
          
//           <ModalBody flex="1" overflow="hidden">
//             <Box display="flex" gap={6} height="100%">
//               {/* 왼쪽 50% - 배치된 학생 목록 */}
//               <VStack spacing={4} align="stretch" width="50%" height="100%">
//                 {/* 배치된 학생 수 정보 */}
//                 <Box flexShrink={0}>
//                   <Text fontSize="md" fontWeight="semibold" mb={2}>
//                     배치된 학생 ({students.length}명)
//                   </Text>
//                   <Text fontSize="sm" color="gray.600">
//                     학생을 클릭하면 미배치 영역으로 이동합니다.
//                   </Text>
//                 </Box>

//                 <Divider flexShrink={0} />

//                 {/* 배치된 학생 목록 */}
//                 <Box flex="1" overflowY="auto" p={1}>
//                   {students.length > 0 ? (
//                     <SimpleGrid columns={[1, 4]} spacing={3}>
//                       {students
//                         .slice()
//                         .sort((a, b) => a.student_name.localeCompare(b.student_name, 'ko'))
//                         .map(student => (
//                           <Box
//                             key={student.id}
//                             p={3}
//                             bg="blue.50"
//                             borderRadius="md"
//                             border="1px solid"
//                             borderColor="blue.200"
//                             cursor="pointer"
//                             _hover={{ 
//                               bg: 'blue.100',
//                               borderColor: 'blue.300',
//                               transform: 'translateY(-1px)'
//                             }}
//                             transition="all 0.2s"
//                             onClick={() => handleModalStudentClick(student)}
//                             textAlign="center"
//                           >
//                             <Text 
//                               fontSize="sm" 
//                               fontWeight="medium"
//                               color="blue.800"
//                             >
//                               {student.student_name}
//                             </Text>
//                             <Text 
//                               fontSize="xs" 
//                               color="blue.600"
//                               mt={1}
//                             >
//                               {student.school} {student.grade}
//                             </Text>
//                           </Box>
//                         ))}
//                     </SimpleGrid>
//                   ) : (
//                     <Box textAlign="center" py={8}>
//                       <Text fontSize="sm" color="gray.500">
//                         배치된 학생이 없습니다.
//                       </Text>
//                     </Box>
//                   )}
//                 </Box>
//               </VStack>

//               {/* 중간 구분선 */}
//               {/* <Box width="1px" bg="gray.100" flexShrink={0} /> */}

//               {/* 오른쪽 50% - 수업 가능 시간표 */}
//               <Box width="50%" height="100%" display="flex" flexDirection="column">
//                 <HStack justify="space-between" mb={1} flexShrink={0}>
//                   <Text fontSize="md" fontWeight="semibold">
//                     수업 가능 시간표
//                   </Text>
//                   {!isEditingSchedule ? (
//                     <Button
//                       size="sm"
//                       colorScheme="blue"
//                       variant="outline"
//                       onClick={handleStartEditing}
//                     >
//                       시간표 수정
//                     </Button>
//                   ) : (
//                     <HStack spacing={2}>
//                       <Button
//                         size="sm"
//                         colorScheme="green"
//                         onClick={handleSaveSchedule}
//                         isLoading={isLoading}
//                         loadingText="저장 중..."
//                       >
//                         저장
//                       </Button>
//                       <Button
//                         size="sm"
//                         variant="outline"
//                         onClick={handleCancelEditing}
//                         disabled={isLoading}
//                       >
//                         취소
//                       </Button>
//                     </HStack>
//                   )}
//                 </HStack>
                
//                 {isEditingSchedule && (
//                   <Text fontSize="xs" color="gray.600" mb={1}>
//                     셀을 클릭하여 수업 가능 시간을 설정/해제하세요
//                   </Text>
//                 )}

//                 <Divider mb={1} flexShrink={0} />

//                 {/* 시간표 테이블 */}
//                 <Box 
//                   border="1px solid" 
//                   borderColor="gray.200" 
//                   borderRadius="md"
//                   overflow="hidden"
//                   flex="1"
//                   display="flex"
//                   flexDirection="column"
//                   minHeight="0"
//                 >
//                   {/* 헤더 */}
//                   <Box display="flex" bg="gray.50" flexShrink={0}>
//                     <Box 
//                       width="60px" 
//                       p={2} 
//                       textAlign="center" 
//                       borderRight="1px solid" 
//                       borderColor="gray.200"
//                       fontSize="xs"
//                       fontWeight="bold"
//                     >
//                       시간
//                     </Box>
//                     {days.map((day) => (
//                       <Box 
//                         key={day}
//                         flex={1} 
//                         p={2} 
//                         textAlign="center" 
//                         borderRight="1px solid" 
//                         borderColor="gray.200"
//                         fontSize="xs"
//                         fontWeight="bold"
//                         _last={{ borderRight: 'none' }}
//                       >
//                         {day}
//                       </Box>
//                     ))}
//                   </Box>
                  
//                   {/* 시간 행들 */}
//                   <Box flex="1" display="flex" flexDirection="column">
//                     {times.map((time) => (
//                       <Box 
//                         key={time} 
//                         display="flex" 
//                         borderBottom="1px solid" 
//                         borderColor="gray.200"
//                         _last={{ borderBottom: 'none' }}
//                         flex="1"
//                         minHeight="28px"
//                       >
//                         <Box 
//                           width="60px" 
//                           p={1} 
//                           textAlign="center" 
//                           borderRight="1px solid" 
//                           borderColor="gray.200"
//                           fontSize="xs"
//                           bg="gray.50"
//                           fontWeight="medium"
//                           display="flex"
//                           alignItems="center"
//                           justifyContent="center"
//                         >
//                           {time}
//                         </Box>
//                         {days.map((day) => (
//                           <Box 
//                             key={`${day}-${time}`}
//                             flex={1} 
//                             p={1} 
//                             textAlign="center" 
//                             borderRight="1px solid" 
//                             borderColor="gray.200"
//                             bg={isTimeAvailable(day, time) ? 'green.100' : 'gray.100'}
//                             _last={{ borderRight: 'none' }}
//                             display="flex"
//                             alignItems="center"
//                             justifyContent="center"
//                             cursor={isEditingSchedule ? 'pointer' : 'default'}
//                             _hover={isEditingSchedule ? {
//                               bg: isTimeAvailable(day, time) ? 'green.200' : 'gray.200',
//                               transform: 'scale(1.05)'
//                             } : {}}
//                             transition="all 0.2s"
//                             onClick={() => handleTimeSlotClick(day, time)}
//                           >
//                             {isTimeAvailable(day, time) && (
//                               <Box 
//                                 width="6px" 
//                                 height="6px" 
//                                 borderRadius="50%" 
//                                 bg="green.500"
//                               />
//                             )}
//                           </Box>
//                         ))}
//                       </Box>
//                     ))}
//                   </Box>
//                 </Box>
//               </Box>
//             </Box>
//           </ModalBody>

//           <ModalFooter pt={1} pr={4} flexShrink={0}>
//             <Button 
//               variant="outline" 
//               mr={3} 
//               onClick={onClose}
//             >
//               닫기
//             </Button>
//             {students.length > 0 && (
//               <Button 
//                 colorScheme="red" 
//                 onClick={handleClearAllStudents}
//               >
//                 전체 배치 초기화
//               </Button>
//             )}
//           </ModalFooter>
//         </ModalContent>
//       </Modal>

//       {/* 확인 다이얼로그 */}
//       <AlertDialog
//         isOpen={isConfirmOpen}
//         leastDestructiveRef={cancelRef}
//         onClose={() => setIsConfirmOpen(false)}
//       >
//         <AlertDialogOverlay>
//           <AlertDialogContent>
//             <AlertDialogHeader fontSize="lg" fontWeight="bold">
//               시간표 업데이트 확인
//             </AlertDialogHeader>

//                          <AlertDialogBody>
//                <Text mb={4} fontSize="md" fontWeight="medium">
//                  시간표 변경으로 인해 다음과 같은 영향이 있습니다:
//                </Text>
//                {affectedStudents.length > 0 && (
//                  <Box mb={4}>
//                    <Text fontSize="sm" fontWeight="semibold" color="orange.600" mb={2}>
//                      배치가 해제될 학생들:
//                    </Text>
//                    {affectedStudents.map(student => (
//                      <Text key={student.id} fontSize="sm" color="gray.700" pl={4}>
//                        • [{student.school}] [{student.grade}] {student.student_name} 학생
//                      </Text>
//                    ))}
//                  </Box>
//                )}
//                {cancelledClinics.length > 0 && (
//                  <Box mb={4}>
//                    <Text fontSize="sm" fontWeight="semibold" color="red.600" mb={2}>
//                      취소될 클리닉:
//                    </Text>
//                    {cancelledClinics.map(clinic => (
//                      <Text key={clinic.id} fontSize="sm" color="gray.700" pl={4}>
//                        • {clinic.clinic_time}
//                      </Text>
//                    ))}
//                  </Box>
//                )}
//                <Text fontSize="sm" color="gray.600">
//                  위 변경사항을 확인하고 시간표를 업데이트하시겠습니까?
//                </Text>
//              </AlertDialogBody>

//              <AlertDialogFooter>
//                <Button ref={cancelRef} onClick={() => setIsConfirmOpen(false)}>
//                  취소
//                </Button>
//                <Button colorScheme="red" onClick={completeScheduleUpdate} ml={3}>
//                  확인 및 업데이트
//                </Button>
//              </AlertDialogFooter>
//           </AlertDialogContent>
//         </AlertDialogOverlay>
//       </AlertDialog>
//     </>
//   );
// };

// export default TeacherBox; 