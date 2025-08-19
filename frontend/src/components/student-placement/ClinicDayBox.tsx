import React from 'react';
import { Box, VStack, Text, Badge, Button, Flex, Tooltip, Center } from '@chakra-ui/react';
// import { useDrop } from 'react-dnd'; // drag&drop 주석처리
import { Clinic, Student } from '@/lib/types'; // types.ts에서 Student와 Clinic import
// import { ItemTypes } from './StudentItem'; // ItemTypes만 StudentItem에서 import - drag&drop 주석처리

interface ClinicDayBoxProps {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  dayLabel: string;
  clinics: Clinic[];
  onClinicClick: (day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun') => void; // 요일을 전달하도록 변경
  onStudentDrop?: (day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', students: Student[]) => void;
  isStudentAlreadyAssigned?: (studentId: number, day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun') => boolean;
}

// 시간대 선택지 정의
const TIME_SLOTS = ['18:00', '19:00', '20:00', '21:00'];

const ClinicDayBox: React.FC<ClinicDayBoxProps> = ({
  day,
  dayLabel,
  clinics,
  onClinicClick,
  onStudentDrop,
  isStudentAlreadyAssigned,
}) => {
  // 해당 요일의 시간대별 클리닉 찾기
  const dayClinics = TIME_SLOTS.map(timeSlot => 
    clinics.find(clinic => clinic.clinic_day === day && clinic.clinic_time === timeSlot)
  );

  // 해당 요일에 클리닉이 하나라도 있는지 확인
  const hasAnyClinics = dayClinics.some(clinic => clinic !== undefined);

  // 드롭 기능 구현 - drag&drop 주석처리
  // const [{ isOver, canDrop }, dropRef] = useDrop({
  //   accept: ItemTypes.STUDENT,
  //   canDrop: (item: { 
  //     id: number; 
  //     student: Student; 
  //     selectedStudents?: Student[]; 
  //     isMultiple?: boolean; 
  //   }) => {
  //     // 클리닉이 없으면 드롭 불가
  //     if (!hasAnyClinics) return false;
  //     
  //     // 이미 배치된 학생이 있는지 확인
  //     if (isStudentAlreadyAssigned) {
  //       const studentsToCheck = item.isMultiple && item.selectedStudents ? 
  //         item.selectedStudents : [item.student];
  //       
  //       // 하나라도 이미 배치된 학생이 있으면 드롭 불가
  //       return !studentsToCheck.some(student => 
  //         isStudentAlreadyAssigned(student.id, day)
  //       );
  //     }
  //     
  //     return true;
  //   },
  //   drop: (item: { 
  //     id: number; 
  //     student: Student; 
  //     selectedStudents?: Student[]; 
  //     isMultiple?: boolean; 
  //   }) => {
  //     // 드롭 이벤트 핸들러 호출
  //     if (onStudentDrop) {
  //       // 다중 선택된 학생들이 있는 경우
  //       if (item.isMultiple && item.selectedStudents) {
  //         onStudentDrop(day, item.selectedStudents);
  //       } else {
  //         // 단일 학생
  //         onStudentDrop(day, [item.student]);
  //       }
  //     }
  //     
  //     return { dropped: true };
  //   },
  //   collect: (monitor) => ({
  //     isOver: !!monitor.isOver(),
  //     canDrop: !!monitor.canDrop(),
  //   }),
  // });

  const handleBoxClick = () => {
    onClinicClick(day); // 요일을 전달
  };

  return (
    <Box
      // ref={dropRef as any} // drag&drop 주석처리
      border="1px solid"
      borderColor="gray.300" // drag&drop 조건 제거
      borderRadius="lg"
      p={4}
      h="full"
      minH="300px"
      bg="white" // drag&drop 조건 제거
      cursor={hasAnyClinics ? "pointer" : "default"}
      _hover={hasAnyClinics ? { 
        borderColor: 'blue.400', 
        shadow: 'md'
      } : {}}
      transition="all 0.2s"
      onClick={handleBoxClick}
      position="relative"
    >
      {/* 드롭 오버레이 - drag&drop 주석처리 */}
      {/* {isOver && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg={canDrop ? 'green.100' : 'red.100'}
          borderRadius="lg"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={10}
          opacity={0.8}
        >
          <VStack spacing={2}>
            <Text fontSize="3xl">
              {canDrop ? '📥' : '❌'}
            </Text>
            <Text fontSize="lg" fontWeight="bold" color={canDrop ? 'green.700' : 'red.700'}>
              {canDrop ? '학생 배치' : '중복 배치 불가'}
            </Text>
          </VStack>
        </Box>
      )} */}
      
      {/* 요일 헤더 */}
      <Flex justify="center" align="center" mb={6}>
        <Text fontSize="xl" fontWeight="bold" color="gray.700">
          {dayLabel}
        </Text>
      </Flex>

      {/* 클리닉 정보 */}
      {!hasAnyClinics ? (
        <Center py={8} flexDirection="column">
          <Text color="gray.500" fontSize="2xl" mb={3}>
            🕐
          </Text>
          <Text color="gray.500" fontSize="md" mb={2}>
            등록된 클리닉이 없습니다
          </Text>
          <Text color="gray.400" fontSize="sm">
            클릭하여 클리닉을 생성하세요
          </Text>
        </Center>
      ) : (
        <VStack align="stretch" spacing={4}>
          {/* 시간대별 학생 수 표시 */}
          <VStack align="stretch" spacing={3}>
            <Text fontSize="sm" fontWeight="semibold" color="gray.600" textAlign="center">
              시간대별 현황
            </Text>
            
            <VStack spacing={2}>
              {TIME_SLOTS.map((timeSlot) => {
                const clinic = dayClinics.find(c => c?.clinic_time === timeSlot);
                const studentCount = clinic?.clinic_students?.length || 0;
                const capacity = clinic?.clinic_capacity || 0;
                const isActive = clinic !== undefined;
                
                return (
                  <Flex 
                    key={timeSlot}
                    justify="space-between" 
                    align="center"
                    w="full"
                    p={2}
                    bg={isActive ? 'white.50' : 'gray.50'}
                    borderRadius="md"
                    border="1px solid"
                    borderColor={isActive ? 'gray.300' : 'gray.300'}
                  >
                    <Flex align="center" gap={2}>
                      {/* <Text fontSize="sm" color={isActive ? "blue.600" : "gray.500"}>
                        🕐
                      </Text> */}
                      <Text 
                        fontSize="sm" 
                        fontWeight="medium"
                        color={isActive ? "blue.700" : "gray.500"}
                      >
                        {timeSlot}
                      </Text>
                    </Flex>
                    
                    <Badge 
                      colorScheme={
                        !isActive ? "gray" :
                        studentCount >= capacity ? "red" : 
                        studentCount > 0 ? "green" : "gray"
                      } 
                      size="sm"
                      px={2}
                    >
                      {isActive ? `${studentCount}/${capacity}명` : '없음'}
                    </Badge>
                  </Flex>
                );
              })}
            </VStack>
          </VStack>

          {/* 총 학생 수 */}
          {/* <Box
            w="full"
            p={3}
            bg="green.50"
            border="1px solid"
            borderColor="green.200"
            borderRadius="md"
            textAlign="center"
          >
            <Text fontSize="sm" color="green.600" fontWeight="semibold">
              📚 총 신청 학생 수
            </Text>
            <Text fontSize="lg" fontWeight="bold" color="green.700">
              {dayClinics.reduce((total, clinic) => 
                total + (clinic?.clinic_students?.length || 0), 0
              )}명
            </Text>
          </Box> */}

          {/* 클릭 안내 */}
          {/* <Box
            w="full"
            pt={2}
            borderTop="1px solid"
            borderColor="gray.200"
          >
            <Text fontSize="xs" color="gray.500" textAlign="center">
              클릭하여 시간대별 학생 관리
            </Text>
          </Box> */}
        </VStack>
      )}
    </Box>
  );
};

export default ClinicDayBox; 