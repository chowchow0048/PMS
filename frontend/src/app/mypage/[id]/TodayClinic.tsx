'use client';

import React, { useState, useEffect } from 'react';
import { useClinic } from './ClinicContext';
import styles from './page.module.css';

// 오늘의 클리닉 아이템 타입 정의
interface TodayClinicItem {
  id?: number;
  day: string;
  time: string;
  students: Array<{
    id: number;
    name: string;
    school?: string;
    grade?: string;
    status?: string;
  }>;
  clinic_subject?: number;
}

// 출석 체크 모달 컴포넌트
interface AttendanceModalProps {
  clinic: TodayClinicItem;
  isOpen: boolean;
  onClose: () => void;
}

const AttendanceModal: React.FC<AttendanceModalProps> = ({ clinic, isOpen, onClose }) => {
  const [attendanceStatus, setAttendanceStatus] = useState<{ [key: number]: boolean }>({});

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // 출석 체크 핸들러
  const handleAttendanceCheck = async (studentId: number) => {
    try {
      // 현재 날짜와 시간 정보 생성
      const now = new Date();
      const attendanceRecord = {
        date: now.toISOString().split('T')[0], // YYYY-MM-DD 형식
        time: clinic.time,
        day: clinic.day,
        timestamp: now.toISOString()
      };

      // 토큰 가져오기
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('인증 정보가 없습니다.');
      }

      // 백엔드 API 호출하여 출석 기록 저장
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${API_URL}/students/${studentId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clinic_attended_dates: [attendanceRecord] // 백엔드에서 기존 기록에 추가 처리
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('출석 체크 API 오류:', errorData);
        throw new Error('출석 체크 저장에 실패했습니다.');
      }

      // 로컬 상태 업데이트
      setAttendanceStatus(prev => ({
        ...prev,
        [studentId]: true
      }));

      // 성공 메시지 표시
      const studentName = clinic.students.find(s => s.id === studentId)?.name || '학생';
      alert(`${studentName}님의 출석이 기록되었습니다.`);
      
    } catch (error) {
      console.error('출석 체크 오류:', error);
      alert(`출석 체크 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {clinic.day}요일 {clinic.time} 클리닉 출석 체크
          </h3>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalSection}>
            <h4 className={styles.modalSectionTitle}>
              참여 학생 ({clinic.students.length}명)
            </h4>
            <div className={styles.attendanceList}>
              {clinic.students.map(student => (
                <div key={student.id} className={styles.attendanceItem}>
                  <div className={styles.studentInfo}>
                    <div>
                      <span className={styles.modalStudentSchool}>{student.school}</span>
                      <span className={styles.modalStudentGrade}>{student.grade}</span>
                    </div>
                    <div className={styles.modalStudentName}>
                      {student.name}
                    </div>
                  </div>
                  <button
                    className={`${styles.attendanceButton} ${
                      attendanceStatus[student.id] ? styles.attendanceChecked : ''
                    }`}
                    onClick={() => handleAttendanceCheck(student.id)}
                    disabled={attendanceStatus[student.id]}
                  >
                    {attendanceStatus[student.id] ? '출석 완료' : '출석 체크'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.modalFooterFullWidth}>
          <button
            className={`${styles.modalButtonFullWidth} ${styles.closeButton}`}
            onClick={onClose}
            style={{ borderRadius: '0 0 12px 12px', height: '100%'}}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// 오늘의 클리닉 카드 컴포넌트
interface TodayClinicCardProps {
  clinic: TodayClinicItem;
  onClick: () => void;
}

const TodayClinicCard: React.FC<TodayClinicCardProps> = ({ clinic, onClick }) => {
  return (
    <div className={styles.todayClinicCard} onClick={onClick}>
      <div className={styles.todayClinicHeader}>
        <div className={styles.todayClinicTime}>
          {clinic.time}
        </div>
        <div className={styles.todayClinicStudentCount}>
          {clinic.students.length}명
        </div>
      </div>
      <div className={styles.todayClinicStudents}>
        {clinic.students.slice(0, 3).map((student, index) => (
          <div key={student.id} className={styles.todayClinicStudent}>
            <span className={styles.todayClinicStudentSchool}>{student.school}</span>
            <span className={styles.todayClinicStudentGrade}>{student.grade}</span>
            <span className={styles.todayClinicStudentName}>{student.name}</span>
          </div>
        ))}
        {clinic.students.length > 3 && (
          <div className={styles.todayClinicMoreStudents}>
            외 {clinic.students.length - 3}명
          </div>
        )}
      </div>
    </div>
  );
};

// 메인 오늘의 클리닉 컴포넌트
const TodayClinic: React.FC = () => {
  const { clinics, isLoading, error } = useClinic();
  const [selectedClinic, setSelectedClinic] = useState<TodayClinicItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 오늘 요일 가져오기
  const getTodayKoreanDay = (): string => {
    const today = new Date();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return dayNames[today.getDay()];
  };

  // 오늘의 클리닉 필터링 및 타입 변환
  const todayClinics: TodayClinicItem[] = clinics
    .filter(clinic => {
      // 오늘 요일이고, 학생이 실제로 있는 클리닉만 필터링
      const isToday = clinic.day === getTodayKoreanDay();
      const hasStudents = clinic.students && clinic.students.length > 0;
      
      return isToday && hasStudents;
    })
    .map(clinic => ({
      ...clinic,
      students: clinic.students.map(student => ({
        id: student.id,
        name: student.name,
        school: student.school,
        grade: student.grade,
        status: student.status
      }))
    }));

  // 시간순으로 정렬
  const sortedTodayClinics = todayClinics.sort((a, b) => {
    const timeA = parseInt(a.time.split(':')[0]);
    const timeB = parseInt(b.time.split(':')[0]);
    return timeA - timeB;
  });

  // 클리닉 카드 클릭 핸들러
  const handleClinicClick = (clinic: TodayClinicItem) => {
    setSelectedClinic(clinic);
    setIsModalOpen(true);
  };

  // 모달 닫기 핸들러
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedClinic(null);
  };

  if (error) {
    return (
      <div className={styles.errorMessage}>
        <h2>오류가 발생했습니다</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>오늘의 클리닉 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className={styles.todayClinicContainer}>
      <div className={styles.todayClinicHeader}>
        <h2 className={styles.todayClinicTitle}>
          오늘의 클리닉 ({getTodayKoreanDay()}요일)
        </h2>
        <div className={styles.todayClinicCount}>
          총 {sortedTodayClinics.length}개 클리닉
        </div>
      </div>

      {sortedTodayClinics.length > 0 ? (
        <div className={styles.todayClinicList}>
          {sortedTodayClinics.map((clinic, index) => (
            <TodayClinicCard
              key={`${clinic.day}-${clinic.time}-${index}`}
              clinic={clinic}
              onClick={() => handleClinicClick(clinic)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyMessage}>
          <h3>오늘 예정된 클리닉이 없습니다</h3>
          <p>다른 요일에 클리닉을 확인해보세요.</p>
        </div>
      )}

      {/* 출석 체크 모달 */}
      {selectedClinic && (
        <AttendanceModal
          clinic={selectedClinic}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default TodayClinic; 