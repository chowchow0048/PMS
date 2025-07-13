import React from 'react';
import { Box, VStack, Text, Badge, Button, Flex, Tooltip, Center } from '@chakra-ui/react';
import { useDrop } from 'react-dnd';
import { Clinic } from '@/lib/types';
import { Student, ItemTypes } from './StudentItem';

interface ClinicDayBoxProps {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri';
  dayLabel: string;
  clinics: Clinic[];
  onClinicClick: (clinic: Clinic) => void;
  onStudentDrop?: (day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri', students: Student[]) => void;
  isStudentAlreadyAssigned?: (studentId: number, day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri') => boolean;
}

const ClinicDayBox: React.FC<ClinicDayBoxProps> = ({
  day,
  dayLabel,
  clinics,
  onClinicClick,
  onStudentDrop,
  isStudentAlreadyAssigned,
}) => {
  // 해당 요일의 클리닉 찾기 (요일당 1개만 존재)
  const dayClinic = clinics.find(clinic => clinic.clinic_day === day);

  // 드롭 기능 구현
  const [{ isOver, canDrop }, dropRef] = useDrop({
    accept: ItemTypes.STUDENT,
    canDrop: (item: { 
      id: number; 
      student: Student; 
      selectedStudents?: Student[]; 
      isMultiple?: boolean; 
    }) => {
      // 클리닉이 없으면 드롭 불가
      if (!dayClinic) return false;
      
      // 이미 배치된 학생이 있는지 확인
      if (isStudentAlreadyAssigned) {
        const studentsToCheck = item.isMultiple && item.selectedStudents ? 
          item.selectedStudents : [item.student];
        
        // 하나라도 이미 배치된 학생이 있으면 드롭 불가
        return !studentsToCheck.some(student => 
          isStudentAlreadyAssigned(student.id, day)
        );
      }
      
      return true;
    },
    drop: (item: { 
      id: number; 
      student: Student; 
      selectedStudents?: Student[]; 
      isMultiple?: boolean; 
    }) => {
      // 드롭 이벤트 핸들러 호출
      if (onStudentDrop) {
        // 다중 선택된 학생들이 있는 경우
        if (item.isMultiple && item.selectedStudents) {
          onStudentDrop(day, item.selectedStudents);
        } else {
          // 단일 학생
          onStudentDrop(day, [item.student]);
        }
      }
      
      return { dropped: true };
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  });

  const handleBoxClick = () => {
    if (dayClinic) {
      onClinicClick(dayClinic);
    }
  };

  return (
    <Box
      ref={dropRef as any}
      border="1px solid"
      borderColor={
        isOver && canDrop ? 'green.400' : 
        isOver ? 'red.400' : 
        'gray.300'
      }
      borderRadius="lg"
      p={4}
      h="full"
      minH="300px"
      bg={
        isOver && canDrop ? 'green.50' : 
        isOver ? 'red.50' : 
        'white'
      }
      cursor={dayClinic ? "pointer" : "default"}
      _hover={dayClinic ? { 
        borderColor: 'blue.400', 
        shadow: 'md'
      } : {}}
      transition="all 0.2s"
      onClick={handleBoxClick}
      position="relative"
    >
      {/* 드롭 오버레이 */}
      {isOver && (
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
      )}
      
      {/* 요일 헤더 */}
      <Flex justify="space-between" align="center" mb={4}>
        <Text fontSize="lg" fontWeight="bold" color="gray.700">
          {dayLabel}
        </Text>
        {/* 클리닉 개수 배지 제거 (요일당 1개 고정) */}
      </Flex>

      {/* 클리닉 정보 */}
      {!dayClinic ? (
        <Center py={8} flexDirection="column">
          <Text color="gray.500" fontSize="md" mb={2}>
            📅
          </Text>
          <Text color="gray.500" fontSize="sm">
            등록된 클리닉이 없습니다.
          </Text>
          <Text color="gray.400" fontSize="xs" mt={1}>
            클릭하여 클리닉을 생성하세요.
          </Text>
        </Center>
      ) : (
        <VStack align="start" spacing={4}>
          {/* 담당 선생님 정보 */}
          <Box
            w="full"
            p={3}
            bg="blue.50"
            border="1px solid"
            borderColor="blue.200"
            borderRadius="md"
          >
            <VStack align="start" spacing={2}>
              <Flex justify="space-between" w="full">
                <Text fontSize="md" fontWeight="semibold" color="blue.800">
                  👨‍🏫 {dayClinic.teacher_name}
                </Text>
              </Flex>
            </VStack>
          </Box>

          {/* 시간대별 학생 수 정보 */}
          <VStack align="start" spacing={3} w="full">
            <Text fontSize="sm" fontWeight="semibold" color="gray.600">
              📊 학생 현황
            </Text>
            
            <VStack align="start" spacing={2} w="full">
              {/* Prime Clinic */}
              <Flex justify="space-between" w="full" align="center">
                <Flex align="center" gap={2}>
                  <Text fontSize="sm" color="green.600">📚</Text>
                  <Text fontSize="sm" color="green.700">숙제 해설 (18:00-19:00)</Text>
                </Flex>
                <Badge colorScheme="green" size="sm">
                  {dayClinic.clinic_prime_students.length}명
                </Badge>
              </Flex>
              
              {/* Sub Clinic */}
              <Flex justify="space-between" w="full" align="center">
                <Flex align="center" gap={2}>
                  <Text fontSize="sm" color="orange.600">❓</Text>
                  <Text fontSize="sm" color="orange.700">자유 질문 (19:00-22:00)</Text>
                </Flex>
                <Badge colorScheme="orange" size="sm">
                  {dayClinic.clinic_sub_students.length}명
                </Badge>
              </Flex>
              
              {/* 미배치 학생 */}
              <Flex justify="space-between" w="full" align="center">
                <Flex align="center" gap={2}>
                  <Text fontSize="sm" color="gray.600">👥</Text>
                  <Text fontSize="sm" color="gray.700">미배치</Text>
                </Flex>
                <Badge colorScheme="gray" size="sm">
                  {dayClinic.clinic_unassigned_students.length}명
                </Badge>
              </Flex>
            </VStack>
          </VStack>

          {/* 클릭 안내 */}
          <Box
            w="full"
            mt="auto"
            pt={3}
            borderTop="1px solid"
            borderColor="gray.200"
          >
            <Text fontSize="xs" color="gray.500" textAlign="center">
              클릭하여 학생 배치 관리
            </Text>
          </Box>
        </VStack>
      )}
    </Box>
  );
};

export default ClinicDayBox; 