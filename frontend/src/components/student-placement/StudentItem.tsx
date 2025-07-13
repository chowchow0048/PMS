'use client';

import { FC, useRef } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { useDrag } from 'react-dnd';

// 시간 객체 인터페이스 정의
export interface Time {
  id: number;
  time_day: string;
  time_slot: string;
  time_day_display?: string;
  time_slot_formatted?: string;
}

// 학생 객체 인터페이스 정의
export interface Student {
  id: number;
  student_name: string;
  student_phone_num: string;  // 학생 전화번호
  student_parent_phone_num: string;  // 학부모 전화번호
  school: string;  // 학교 정보
  grade: string;  // 학년 정보
  student_subject?: number;  // 학생 과목 ID
  subject_name?: string; // 학생 과목 이름
  reserved_clinic?: number;  // 예약된 클리닉 ID
  // assigned_teacher?: number;  // 배정된 교사 ID (보충 시스템 개편으로 deprecated)
  // assigned_teacher_name?: string; // 배정된 교사 이름 (보충 시스템 개편으로 deprecated)
  // expected_teacher?: string; // 희망 선생님 (보충 시스템 개편으로 deprecated)
  // available_time?: number[]; // 가능한 시간 ID 배열 (보충 시스템 개편으로 deprecated)
  // available_time_details?: Time[]; // 가능한 시간 상세 정보 (보충 시스템 개편으로 deprecated)
}

// 학생 아이템 컴포넌트 props 인터페이스
interface StudentItemProps {
  student: Student;
  isAssigned: boolean;  // 배치 여부
  isHighlighted?: boolean; // 검색 결과 하이라이트 여부
  isSelected?: boolean; // 선택 상태
  onSelect?: (student: Student, event: React.MouseEvent) => void; // 선택 핸들러
  selectedStudents?: Student[]; // 선택된 학생들 목록 (다중 드래그용)
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
  selectedStudents = []
}) => {
  // 드래그 기능 구현
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: ItemTypes.STUDENT,
    item: () => {
      // 선택된 학생이 있고 현재 학생이 선택된 상태라면 모든 선택된 학생을 드래그
      if (isSelected && selectedStudents.length > 1) {
        return { 
          id: student.id, 
          student,
          selectedStudents: selectedStudents,
          isMultiple: true
        };
      }
      // 단일 드래그
      return { 
        id: student.id, 
        student,
        selectedStudents: [student],
        isMultiple: false
      };
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [student, isSelected, selectedStudents]);

  // 클릭 핸들러
  const handleClick = (event: React.MouseEvent) => {
    if (onSelect) {
      onSelect(student, event);
    }
  };

  // 학생 아이템 스타일 설정
  return (
    <Box
      ref={dragRef as any}
      opacity={isDragging ? 0.4 : 1}
      cursor="move"
      p={0}
      mb={1}
      borderRadius="md"
      bg={
        isSelected ? 'blue.200' : 
        isHighlighted ? 'blue.50' : 
        'transparent'
      }
      border="1px solid"
      borderColor={
        isSelected ? 'blue.300' :
        isHighlighted ? 'blue.200' : 
        'transparent'
      }
      _hover={{ 
        bg: isSelected ? 'blue.300' :
            isHighlighted ? 'blue.100' : 
            'gray.100' 
      }}
      _focus={{
        outline: 'none',
        borderColor: isSelected ? 'blue.400' : 'blue.300',
        bg: isSelected ? 'blue.300' : 'blue.100'
      }}
      display="flex"
      justifyContent="center"
      alignItems="center"
      width="100%"
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
          isSelected ? 'blue.800' :
          isHighlighted ? 'blue.700' : 
          'gray.800'
        }
      >
        {student.student_name}
      </Text>
      
      {/* 다중 선택 시 개수 표시 */}
      {isSelected && selectedStudents.length > 1 && isDragging && (
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
      )}
    </Box>
  );
};

export default StudentItem; 