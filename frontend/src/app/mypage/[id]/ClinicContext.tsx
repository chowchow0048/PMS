'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  fetchUsersClinics, 
  fetchUnassignedStudents, 
  saveClinicData,
  Student,
  Clinic
} from './clinicService';
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

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // 토큰 확인
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No authentication token found');
          setError('인증 정보가 없습니다.');
          setIsLoading(false);
          return;
        }
        
        if (!userId) {
          setError('사용자 ID를 찾을 수 없습니다.');
          setIsLoading(false);
          return;
        }
        
        // 백엔드에서 클리닉 데이터 가져오기
        const clinicsData = await fetchUsersClinics(userId);
        
        // 일단 모든 클리닉을 표시하도록 임시 수정 (디버깅용)
        // const validClinics = clinicsData.filter(clinic => clinic.students && clinic.students.length > 0);
        const validClinics = clinicsData; // 임시로 모든 클리닉 표시
        
        setClinics(validClinics);
        
        // 백엔드에서 미배정 학생 데이터 가져오기
        const studentsData = await fetchUnassignedStudents();
        setUnassignedStudents(studentsData);
        
        // 로딩 완료
        setIsLoading(false);

        
        // 데이터 로딩 확인용 로그
        // console.log('클리닉 데이터 로드 완료:', clinicsData.length, '개');
        // console.log('필터링된 클리닉:', validClinics.length, '개');
        // console.log('학생 데이터 로드 완료:', studentsData.length, '명');
      } catch (err) {
        console.error('Failed to fetch clinic data:', err);
        setError(err instanceof Error ? err.message : '데이터를 가져오는데 실패했습니다.');
        setIsLoading(false);
      }
    };
    
    if (userId) {
      fetchData();
    }
  }, [userId]);

  // 클리닉 추가 함수
  const addClinic = (day: string, time: string) => {
    if (!getClinicByDayAndTime(day, time)) {
      setClinics(prev => [...prev, { day, time, students: [], startTime: time }]);
    }
  };

  // 클리닉 제거 함수
  const removeClinic = (day: string, time: string) => {
    const clinic = getClinicByDayAndTime(day, time);
    if (clinic) {
      // 클리닉에 배치된 학생들을 미배치 상태로 변경
      setUnassignedStudents(prev => [...prev, ...clinic.students]);
      // 클리닉 제거
      setClinics(prev => prev.filter(c => !(c.day === day && c.time === time)));
    }
  };

  // 학생 배치 함수
  const assignStudent = (studentId: number, day: string, time: string) => {
    // 미배치 학생 찾기
    const student = unassignedStudents.find(s => s.id === studentId);
    if (!student) return;

    // 클리닉에 배치될 학생의 상태를 'clinic-assigned'로 변경
    const updatedStudent = { ...student, status: 'clinic-assigned' as const };

    // 해당 클리닉 찾기 또는 생성
    let clinic = getClinicByDayAndTime(day, time);
    if (!clinic) {
      addClinic(day, time);
      clinic = { day, time, students: [], startTime: time };
    }

    // 클리닉에 학생 추가 (해당 시간에만)
    setClinics(prev => 
      prev.map(c => 
        c.day === day && c.time === time 
          ? { ...c, students: [...c.students, updatedStudent], startTime: time } 
          : c
      )
    );

    // 미배치 학생에서 제거
    setUnassignedStudents(prev => prev.filter(s => s.id !== studentId));
  };

  // 학생 미배치 함수
  const unassignStudent = (studentId: number) => {
    // 모든 클리닉에서 학생 찾기
    let foundStudent: Student | undefined;
    let foundClinicDay = '';
    let foundClinicTime = '';

    // 먼저 학생이 있는 클리닉을 찾음
    for (const clinic of clinics) {
      const student = clinic.students.find(s => s.id === studentId);
      if (student) {
        foundStudent = student;
        foundClinicDay = clinic.day;
        foundClinicTime = clinic.time;
        break;
      }
    }

    if (foundStudent) {
      // 상태를 'assigned'로 변경
      const updatedStudent = { ...foundStudent, status: 'assigned' as const };
      
      // 해당 클리닉에서만 학생 제거
      setClinics(prev => 
        prev.map(c => 
          c.day === foundClinicDay && c.time === foundClinicTime 
            ? { ...c, students: c.students.filter(s => s.id !== studentId) } 
            : c
        )
      );
      
      // 미배치 학생에 추가
      setUnassignedStudents(prev => [...prev, updatedStudent]);
    }
  };

  // 학생을 다른 클리닉으로 이동시키는 함수
  const moveStudent = (studentId: number, fromDay: string, fromTime: string, toDay: string, toTime: string) => {
    // 원래 클리닉에서 학생 찾기
    const fromClinic = getClinicByDayAndTime(fromDay, fromTime);
    if (!fromClinic) return;

    const student = fromClinic.students.find(s => s.id === studentId);
    if (!student) return;

    // 기존 클리닉에서 학생 제거
    setClinics(prev => 
      prev.map(c => 
        c.day === fromDay && c.time === fromTime 
          ? { ...c, students: c.students.filter(s => s.id !== studentId) } 
          : c
      )
    );
    
    // 새 위치에 배치
    let toClinic = getClinicByDayAndTime(toDay, toTime);
    if (!toClinic) {
      addClinic(toDay, toTime);
    }
    
    setClinics(prev => 
      prev.map(c => 
        c.day === toDay && c.time === toTime 
          ? { ...c, students: [...c.students, student], startTime: toTime } 
          : c
      )
    );
  };

  // 클리닉 초기화 함수
  const resetClinic = (day: string, time: string) => {
    const clinic = getClinicByDayAndTime(day, time);
    if (!clinic) return;
    
    // 학생 상태를 'assigned'로 변경
    const studentsToReset = clinic.students.map(student => ({
      ...student,
      status: 'assigned' as const
    }));
    
    // 해당 클리닉만 초기화
    setClinics(prev => 
      prev.map(c => 
        c.day === day && c.time === time 
          ? { ...c, students: [] } 
          : c
      )
    );
    
    // 미배치 학생에 중복 없이 추가
    setUnassignedStudents(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const newStudents = studentsToReset.filter(student => !existingIds.has(student.id));
      return [...prev, ...newStudents];
    });
  };

  // 요일과 시간으로 클리닉 찾기
  const getClinicByDayAndTime = (day: string, time: string): Clinic | undefined => {
    return clinics.find(c => c.day === day && c.time === time);
  };
  
  // // 학생의 실제 시작 시간 찾기 (2시간 블록의 첫 시간 찾기)
  // const findStudentStartTime = (studentId: number): { day: string, time: string } | null => {
  //   // 모든 클리닉 확인
  //   for (const clinic of clinics) {
  //     // 해당 학생이 있는 클리닉 찾기
  //     const hasStudent = clinic.students.some(s => s.id === studentId);
  //     if (hasStudent) {
  //       // 클리닉의 startTime과 time이 같으면 이것이 시작 시간
  //       if (clinic.startTime === clinic.time) {
  //         return { day: clinic.day, time: clinic.time };
  //       } else {
  //         // 이전 시간 확인 (이전 시간이 시작 시간일 수 있음)
  //         const prevHour = getPreviousHour(clinic.time);
  //         if (prevHour) {
  //           const prevClinic = getClinicByDayAndTime(clinic.day, prevHour);
  //           if (prevClinic && prevClinic.students.some(s => s.id === studentId)) {
  //             return { day: clinic.day, time: prevHour };
  //           }
  //         }
  //         // 그 외의 경우 현재 시간을 시작 시간으로 반환
  //         return { day: clinic.day, time: clinic.time };
  //       }
  //     }
  //   }
  //   return null;
  // };

  // 이전 시간 가져오기 (예: "16:00" -> "15:00")
  const getPreviousHour = (time: string): string | null => {
    const hourMatch = time.match(/^(\d+):00$/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1]);
      if (hour > 10) { // 10시가 첫 시간으로 가정
        return `${hour - 1}:00`;
      }
    }
    return null;
  };

  // // 다음 시간 가져오기 (예: "15:00" -> "16:00")
  // const getNextHour = (time: string): string | null => {
  //   const hourMatch = time.match(/^(\d+):00$/);
  //   if (hourMatch) {
  //     const hour = parseInt(hourMatch[1]);
  //     if (hour < 22) { // 22시가 마지막 시간으로 가정
  //       return `${hour + 1}:00`;
  //     }
  //   }
  //   return null;
  // };

  // 변경사항 저장 함수
  const saveChanges = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 토큰 확인
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        setError('인증 정보가 없습니다.');
        setIsLoading(false);
        return;
      }
      
      if (!userId) {
        setError('사용자 ID를 찾을 수 없습니다.');
        setIsLoading(false);
        return;
      }
      
      // 클리닉 데이터 저장
      await saveClinicData(clinics, userId);
      
      // 저장 후 데이터 다시 불러오기
      const updatedClinicsData = await fetchUsersClinics(userId);
      // 임시로 필터링 제거 - 모든 클리닉 표시 (디버깅용)
      const validClinics = updatedClinicsData; // 필터링 제거
      setClinics(validClinics);
      
      // 미배치 학생 데이터도 다시 불러오기
      const updatedStudentsData = await fetchUnassignedStudents();
      setUnassignedStudents(updatedStudentsData);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to save clinic data:', error);
      setError(error instanceof Error ? error.message : '데이터를 저장하는데 실패했습니다.');
      setIsLoading(false);
    }
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