import React from 'react';
import { Box, VStack, Text, Badge, Button, Flex, Tooltip, Center, useColorModeValue } from '@chakra-ui/react';
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
  // Material Design 다크테마 색상 설정
  const cardBg = useColorModeValue('white', 'dark.surface');
  const cardBg2 = useColorModeValue('white', 'dark.surface2');
  const borderColor = useColorModeValue('gray.200', 'dark.border');
  const textColor = useColorModeValue('gray.800', 'dark.text');
  const headerBg = useColorModeValue('gray.50', 'dark.hover');
  const hoverBg = useColorModeValue('gray.50', 'dark.hover');
  
  // 해당 요일의 시간대별 클리닉 찾기
  const dayClinics = TIME_SLOTS.map(timeSlot => 
    clinics.find(clinic => clinic.clinic_day === day && clinic.clinic_time === timeSlot)
  );

  // 해당 요일에 클리닉이 하나라도 있는지 확인
  const hasAnyClinics = dayClinics.some(clinic => clinic !== undefined);

  const handleBoxClick = () => {
    onClinicClick(day); // 요일을 전달
  };

  return (
    <Box
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      p={{ base: 3, md: 4 }}
      h="full"
      minH={{ base: "250px", md: "300px" }}
      w="100%"
      bg={cardBg}
      color={textColor}
      cursor={hasAnyClinics ? "pointer" : "default"}
      _hover={hasAnyClinics ? { 
        borderColor: 'gray.600', 
        shadow: 'md'
      } : {}}
      transition="all 0.2s"
      onClick={handleBoxClick}
      position="relative"
    >
      {/* 요일 헤더 */}
      <Flex justify="center" align="center" mb={6}>
        <Text fontSize="xl" fontWeight="bold" color={textColor}>
          {dayLabel}
        </Text>
      </Flex>

      {/* 클리닉 정보 */}
      {!hasAnyClinics ? (
        <Center py={8} flexDirection="column">
          <Text color={useColorModeValue('gray.500', 'dark.textSecondary')} fontSize="2xl" mb={3}>
            🕐
          </Text>
          <Text color={useColorModeValue('gray.500', 'dark.textSecondary')} fontSize="md" mb={2}>
            등록된 클리닉이 없습니다
          </Text>
          <Text color={useColorModeValue('gray.400', 'dark.textSecondary')} fontSize="sm">
            클릭하여 클리닉을 생성하세요
          </Text>
        </Center>
      ) : (
        <VStack align="stretch" spacing={4}>
          {/* 시간대별 학생 수 표시 */}
          <VStack align="stretch" spacing={3}>
            {/* <Text fontSize="sm" fontWeight="semibold" color="gray.600" textAlign="center">
              시간대별 현황
            </Text> */}
            
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
                    bg={isActive ? useColorModeValue('white.50', 'dark.hover') : headerBg}
                    borderRadius="md"
                    border="1px solid"
                    borderColor={borderColor}
                  >
                    <Flex align="center" gap={2}>
                      {/* <Text fontSize="sm" color={isActive ? "blue.600" : "gray.500"}>
                        🕐
                      </Text> */}
                      <Text 
                        fontSize="sm" 
                        fontWeight="medium"
                        color={isActive ? 
                          useColorModeValue("gray.700", "dark.text") : 
                          useColorModeValue("gray.500", "dark.textSecondary")
                        }
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