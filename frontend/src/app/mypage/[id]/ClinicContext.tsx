'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// lib/types.ts에서 정의된 타입들을 가져와서 사용
import { User, Clinic as LibClinic } from '@/lib/types';

// 로컬 Student 타입 (User 기반으로 확장)
interface Student extends User {
  student_name: string;
  status?: 'unassigned' | 'assigned' | 'clinic-assigned'; // 호환성을 위해 추가
}

// 로컬 Clinic 타입 (라이브러리 Clinic 기반으로 확장)
interface Clinic extends Omit<LibClinic, 'clinic_students'> {
  day: string;
  time: string;
  students: Student[];
}
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

// 컨텍스트 상태 타입
interface ClinicContextState {
  clinics: Clinic[];
  unassignedStudents: Student[];
  addClinic: (day: string, time: string) => void;
  removeClinic: (day: string, time: string) => void;
  assignStudent: (studentId: number, day: string, time: string) => void;
  unassignStudent: (studentId: number) => void;
  moveStudent: (studentId: number, fromDay: string, fromTime: string, toDay: string, toTime: string) => void;
  resetClinic: (day: string, time: string) => void;
  getClinicByDayAndTime: (day: string, time: string) => Clinic | undefined;
  saveChanges: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// 기본 컨텍스트 값 생성
const defaultContextValue: ClinicContextState = {
  clinics: [],
  unassignedStudents: [],
  addClinic: () => {},
  removeClinic: () => {},
  assignStudent: () => {},
  unassignStudent: () => {},
  moveStudent: () => {},
  resetClinic: () => {},
  getClinicByDayAndTime: () => undefined,
  saveChanges: async () => {},
  isLoading: false,
  error: null
};

// 컨텍스트 생성
const ClinicContext = createContext<ClinicContextState>(defaultContextValue);

// 컨텍스트 훅
export const useClinic = () => useContext(ClinicContext);

// 컨텍스트 프로바이더 컴포넌트
export const ClinicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // URL에서 ID 추출
  const params = useParams();
  const paramUserId = params.id as string;
  
  // 인증 컨텍스트에서 로그인한 사용자 정보 가져오기
  const { user } = useAuth();
  
  // URL에서 가져온 ID가 없으면 현재 로그인한 사용자의 ID 사용
  const userId = paramUserId || (user ? user.id.toString() : null);
  
  // 클리닉 상태
  const [clinics, setClinics] = useState<Clinic[]>([]);
  // 미배치 학생 상태
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  // 로딩 상태
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 에러 상태
  const [error, setError] = useState<string | null>(null);


  // 임시로 빈 데이터로 초기화 (기존 코드 호환성 유지)
  useEffect(() => {
    setIsLoading(false);
    setError('보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
    setClinics([]);
    setUnassignedStudents([]);
  }, [userId]);

  // 보충 시스템 개편으로 모든 함수들을 비활성화 (기존 코드 호환성을 위해 유지)
  const addClinic = (day: string, time: string) => {
    console.warn('addClinic: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
  };

  const removeClinic = (day: string, time: string) => {
    console.warn('removeClinic: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
  };

  const assignStudent = (studentId: number, day: string, time: string) => {
    console.warn('assignStudent: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
  };

  const unassignStudent = (studentId: number) => {
    console.warn('unassignStudent: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
  };

  const moveStudent = (studentId: number, fromDay: string, fromTime: string, toDay: string, toTime: string) => {
    console.warn('moveStudent: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
  };

  const resetClinic = (day: string, time: string) => {
    console.warn('resetClinic: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
  };

  const getClinicByDayAndTime = (day: string, time: string): Clinic | undefined => {
    return undefined; // 항상 undefined 반환
  };

  const saveChanges = async (): Promise<void> => {
    console.warn('saveChanges: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
    return Promise.resolve();
  };

  // 실제 미배치 학생들 계산 (어떤 클리닉에도 배치되지 않은 학생들)
  const getActualUnassignedStudents = () => {
    // 모든 클리닉에 배치된 학생 ID들 수집
    const assignedStudentIds = new Set<number>();
    clinics.forEach(clinic => {
      clinic.students.forEach(student => {
        assignedStudentIds.add(student.id);
      });
    });
    
    // 배치되지 않은 학생들만 필터링
    return unassignedStudents.filter(student => !assignedStudentIds.has(student.id));
  };

  // 컨텍스트 값
  const value: ClinicContextState = {
    clinics,
    unassignedStudents: getActualUnassignedStudents(),
    addClinic,
    removeClinic,
    assignStudent,
    unassignStudent,
    moveStudent,
    resetClinic,
    getClinicByDayAndTime,
    saveChanges,
    isLoading,
    error
  };

  return (
    <ClinicContext.Provider value={value}>
      {children}
    </ClinicContext.Provider>
  );
}; 