'use client';

import React from 'react';
import styles from './StudentItem.module.css';

// 학생 타입
interface Student {
  id: number;
  name: string;
  school?: string;  // 학교 정보 추가
  grade?: string;   // 학년 정보 추가
  status?: 'unassigned' | 'assigned' | 'clinic-assigned'; // 학생 상태 추가
}

interface StudentItemProps {
  student: Student;
  onDragStart: (e: React.DragEvent, student: Student) => void;
  startTime?: string; // 시작 시간 표시 (클리닉 셀에서 사용)
  currentTime?: string; // 현재 시간 (시작 시간과 비교용)
}

const StudentItem: React.FC<StudentItemProps> = ({ 
  student, 
  onDragStart, 
  startTime, 
  currentTime 
}) => {
  // 시작 시간 표시 로직 변경 - 항상 표시
  const showStartTime = startTime !== undefined;
  
  // 상태에 따른 스타일 클래스 설정
  const statusClass = student.status ? styles[student.status] : '';
  
  return (
    <div 
      className={styles.studentItem}
      draggable
      onDragStart={(e) => onDragStart(e, student)}
    >
      {student.status && (
        <span className={`${styles.statusIndicator} ${statusClass}`}></span>
      )}
      <span className={styles.studentName}>{student.name}</span>
      {showStartTime && (
        <span className={styles.startTime}>({startTime.substring(0, startTime.length - 3)}시)</span>
      )}
    </div>
  );
};

export default StudentItem; 