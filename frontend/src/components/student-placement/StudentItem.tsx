'use client';

import { FC, useRef } from 'react';
import { Box, Text, useColorModeValue } from '@chakra-ui/react';
// import { useDrag } from 'react-dnd'; // drag&drop 기능 주석처리
import { Student } from '@/lib/types'; // types.ts에서 Student import

// 시간 객체 인터페이스 정의
export interface Time {
  id: number;
  time_day: string;
  time_slot: string;
  time_day_display?: string;
  time_slot_formatted?: string;
}

// Student 인터페이스는 types.ts에서 정의되므로 제거
// (기존 주석처리된 Student 인터페이스 제거)

// 학생 아이템 컴포넌트 props 인터페이스
interface StudentItemProps {
  student: Student;
  isAssigned: boolean;  // 배치 여부
  isHighlighted?: boolean; // 검색 결과 하이라이트 여부
  isSelected?: boolean; // 선택 상태
  onSelect?: (student: Student, event: React.MouseEvent) => void; // 선택 핸들러
  // selectedStudents?: Student[]; // 선택된 학생들 목록 (다중 드래그용) - drag&drop 주석처리
  onClick?: (student: Student) => void; // 클릭 핸들러 (클리닉 배치용)
}

// 드래그 아이템 타입 정의
export const ItemTypes = {
  STUDENT: 'student',
};

// 학생 아이템 컴포넌트
const StudentItem: FC<StudentItemProps> = ({ 
  student, 
  isAssigned, 
  isHighlighted = false, 
  isSelected = false, 
  onSelect,
  // selectedStudents = [], // drag&drop 주석처리
  onClick
}) => {
  // Material Design 다크테마 색상 설정
  const cardBg = useColorModeValue('white', 'dark.surface');
  const selectedBg = useColorModeValue('blue.50', 'rgba(66, 165, 245, 0.2)');
  const highlightedBg = useColorModeValue('yellow.100', 'rgba(255, 193, 7, 0.2)');
  const textColor = useColorModeValue('gray.800', 'dark.text');
  const borderColor = useColorModeValue('gray.200', 'dark.border');
  const selectedBorderColor = useColorModeValue('blue.300', 'blue.500');

  // 클릭 핸들러
  const handleClick = (event: React.MouseEvent) => {
    // 선택 핸들러가 있으면 먼저 실행 (다중 선택 등)
    if (onSelect) {
      onSelect(student, event);
    }
    
    // 클리닉 배치 모달 열기 (클릭으로 변경)
    if (onClick && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      onClick(student);
    }
  };

  // 학생 아이템 스타일 설정
  return (
    <Box
      // ref={dragRef as any} // drag&drop 주석처리
      // opacity={isDragging ? 0.4 : 1} // drag&drop 주석처리
      cursor="pointer" // move -> pointer로 변경
      p={0}
      mb={1}
      borderRadius="md"
      bg={
        isSelected ? selectedBg : 
        isHighlighted ? highlightedBg : 
        cardBg
      }
      color={textColor}
      border="1px solid"
      borderColor={
        isSelected ? selectedBorderColor :
        isHighlighted ? selectedBorderColor : 
        borderColor
      }
      _hover={{ 
        bg: isSelected ? useColorModeValue('blue.100', 'rgba(66, 165, 245, 0.3)') :
            isHighlighted ? useColorModeValue('blue.100', 'rgba(66, 165, 245, 0.3)') : 
            useColorModeValue('gray.100', 'dark.hover') 
      }}
      display="flex"
      justifyContent="center"
      alignItems="center"
      width="100%"
      height="60px" // 기본 40px의 1.8배
      textAlign="center"
      transition="all 0.2s"
      onClick={handleClick}
      userSelect="none" // 텍스트 선택 방지
      position="relative"
      boxSizing="border-box" // 크기 변화 방지
      tabIndex={0} // 키보드 접근성을 위해 추가
    >
      <Text 
        fontWeight={
          isSelected ? 'bold' :
          isHighlighted ? 'bold' : 
          'medium'
        } 
        fontSize="sm" 
        color={
          isSelected ? 'white.800' :
          isHighlighted ? 'white.700' : 
          'white.800'
        }
      >
        {student.student_name}
      </Text>
      
      {/* 다중 선택 시 개수 표시 - drag&drop 주석처리 */}
      {/* {isSelected && selectedStudents.length > 1 && isDragging && (
        <Box
          position="absolute"
          top="-8px"
          right="-8px"
          bg="red.500"
          color="white"
          borderRadius="full"
          width="20px"
          height="20px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="xs"
          fontWeight="bold"
        >
          {selectedStudents.length}
        </Box>
      )} */}
    </Box>
  );
};

export default StudentItem; 