'use client';

import React, { useState, useEffect } from 'react';
import styles from './ClinicCell.module.css';
import pageStyles from './page.module.css';
import { useClinic } from './ClinicContext';

// 시간 정보 타입 정의 (실제 API 응답 구조에 맞게 수정)
interface Time {
  id: number;
  time_day: string;
  time_slot: string;
  time_day_display?: string;
  time_slot_formatted?: string;
}

// 강사 정보 타입 정의
interface Teacher {
  id: number;
  name: string;
  available_time?: number[];
  available_time_details?: Time[];
}

interface ClinicCellProps {
  day: string;
  time: string;
  teacher?: Teacher;
}

const ClinicCell: React.FC<ClinicCellProps> = ({ day, time, teacher }) => {
  const { 
    getClinicByDayAndTime, 
    assignStudent,
    addClinic,
    moveStudent,
    resetClinic,
    unassignedStudents,
    unassignStudent
  } = useClinic();
  
  // 모달 상태 관리
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 토스트 메시지 상태 관리
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // 해당 요일/시간에 배정된 클리닉 가져오기
  const clinic = getClinicByDayAndTime(day, time);
  
  // 현재 시간에 시작하는 학생들만 필터링
  const studentsStartingAtThisTime = clinic?.students?.filter(
    student => clinic.time === time
  ) || [];
  
  // 해당 시간이 강사의 available_time에 포함되는지 확인
  const isTimeAvailable = () => {
    if (!teacher?.available_time_details) {
      console.log('Teacher 정보 또는 available_time_details가 없음');
      return true; // 정보가 없으면 모든 시간 활성화
    }
    
    // 요일 매핑
    const dayMap: { [key: string]: string } = {
      '월': 'mon',
      '화': 'tue',
      '수': 'wed',
      '목': 'thu',
      '금': 'fri',
      '토': 'sat',
      '일': 'sun'
    };
    
    const englishDay = dayMap[day];
    if (!englishDay) {
      console.log(`유효하지 않은 요일: ${day}`);
      return false;
    }
    
    // 시간 변환 (10:00 -> 10:00:00)
    const timeWithSeconds = `${time}:00`;
    
    console.log(`클리닉 셀 체크: ${day}(${englishDay}) ${timeWithSeconds}`);
    console.log('Available times:', teacher.available_time_details.map(t => `${t.time_day} ${t.time_slot}`));
    
    // available_time_details에서 해당 요일과 시간 찾기 (올바른 필드명 사용)
    const isAvailable = teacher.available_time_details.some(
      availableTime => {
        const matches = availableTime.time_day === englishDay && availableTime.time_slot === timeWithSeconds;
        if (matches) {
          console.log(`매칭됨: ${availableTime.time_day} ${availableTime.time_slot}`);
        }
        return matches;
      }
    );
    
    console.log(`${day} ${time} 결과: ${isAvailable ? '활성화' : '비활성화'}`);
    return isAvailable;
  };
  
  const isAvailable = isTimeAvailable();
  
  // 셀에 표시할 학생 정보 구성
  const getDisplayContent = () => {
    if (!clinic || !clinic.students || clinic.students.length === 0) {
      return null;
    }
    
    const firstStudent = clinic.students[0];
    
    if (clinic.students.length === 1) {
      // 학생이 한 명인 경우 해당 학생만 표시
      return (
        <div key={firstStudent.id} className={styles.studentItem}>
          {firstStudent.name}
        </div>
      );
    } else {
      // 학생이 여러 명인 경우 첫 학생과 "외 n명" 텍스트 표시
      const remainingCount = clinic.students.length - 1;
      return (
        <div className={styles.studentSummary}>
          <div key={firstStudent.id} className={styles.studentItem}>
            {firstStudent.name}
          </div>
          <div className={styles.otherStudents}>외 {remainingCount}명</div>
        </div>
      );
    }
  };
  
  // 드래그 앤 드롭 이벤트 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    // 사용 불가능한 시간에는 드롭 불가
    if (!isAvailable) return;
    
    // 드래그된 학생 ID 가져오기
    const studentId = parseInt(e.dataTransfer.getData('studentId'));
    if (isNaN(studentId)) return;
    
    // 학생이 다른 클리닉에서 왔는지 확인
    const fromDay = e.dataTransfer.getData('fromDay');
    const fromTime = e.dataTransfer.getData('fromTime');
    
    if (fromDay && fromTime) {
      // 다른 클리닉에서 이동
      moveStudent(studentId, fromDay, fromTime, day, time);
    } else {
      // 미배치 영역에서 배정
      assignStudent(studentId, day, time);
    }
  };
  
  // 클릭 이벤트 핸들러
  const handleClick = () => {
    // 사용 불가능한 시간에는 클릭 불가
    if (!isAvailable) return;
    
    // 클릭하면 항상 모달 열기 (클리닉이 없어도 학생 배치 가능)
    setIsModalOpen(true);
  };
  
  // 드래그 시작 핸들러
  const handleDragStart = (e: React.DragEvent, student: { id: number; name: string }) => {
    e.dataTransfer.setData('studentId', student.id.toString());
    // 출발 클리닉 정보도 저장
    e.dataTransfer.setData('fromDay', day);
    e.dataTransfer.setData('fromTime', time);
  };
  
  // 모달 닫기 핸들러
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  // 클리닉 초기화 핸들러
  const handleResetClinic = () => {
    // 확인 토스트 표시
    setToastMessage('정말 초기화하시겠습니까?');
    setShowToast(true);
  };
  
  // 초기화 확인 핸들러
  const confirmReset = () => {
    resetClinic(day, time);
    setShowToast(false);
    setIsModalOpen(false);
  };
  
  // 초기화 취소 핸들러
  const cancelReset = () => {
    setShowToast(false);
  };

  // ESC 키 이벤트 핸들러 추가
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showToast) {
          // 토스트가 열려있으면 토스트 닫기
          setShowToast(false);
        } else if (isModalOpen) {
          // 모달이 열려있으면 모달 닫기
          setIsModalOpen(false);
        }
      }
    };

    // 모달이나 토스트가 열려있을 때만 이벤트 리스너 추가
    if (isModalOpen || showToast) {
      document.addEventListener('keydown', handleKeyDown);
    }

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, showToast]);

  return (
    <>
      <div 
        className={`${styles.clinicCell} ${!isAvailable ? styles.unavailableCell : ''}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{ 
          cursor: isAvailable ? 'pointer' : 'not-allowed',
          backgroundColor: !isAvailable ? '#e0e0e0' : undefined
        }}
      >
        {getDisplayContent()}
      </div>
      
      {/* 모달 - 클리닉 관리 */}
      {isModalOpen && (
        <div className={pageStyles.modalOverlay} onClick={handleCloseModal}>
          <div className={pageStyles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={pageStyles.modalHeader}>
              <h3 className={pageStyles.modalTitle}>
                {day}요일 {time} 클리닉 관리
              </h3>
            </div>
            <div className={styles.clinicModalBody}>
              {/* 현재 배치된 학생들 */}
              <div className={styles.clinicModalSection}>
                <h4 className={pageStyles.modalSectionTitle}>배치된 학생 ({clinic?.students.length || 0}명)</h4>
                {clinic && clinic.students.length > 0 ? (
                  <div className={pageStyles.modalStudentList}>
                    {clinic.students.map(student => (
                      <div 
                        key={student.id} 
                        className={pageStyles.modalStudent}
                        onClick={() => {
                          // 학생을 클리닉에서 제거 (미배치로 이동)
                          unassignStudent(student.id);
                        }}
                        title="클릭하여 미배치로 이동"
                      >
                        <div className={pageStyles.modalStudentInfo}>
                          <div>
                            <span className={pageStyles.modalStudentSchool}>{student.school}</span>
                            <span className={pageStyles.modalStudentGrade}>{student.grade}</span>
                          </div>
                          <div className={pageStyles.modalStudentName}>
                            {student.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={pageStyles.emptyMessage}>배치된 학생이 없습니다.</p>
                )}
              </div>

              {/* 미배치 학생들 */}
              <div className={styles.clinicModalSection}>
                <h4 className={pageStyles.modalSectionTitle}>미배치 학생 ({unassignedStudents.length}명)</h4>
                {unassignedStudents.length > 0 ? (
                  <div className={pageStyles.modalStudentListGrid}>
                    {unassignedStudents.map(student => (
                      <div 
                        key={student.id} 
                        className={pageStyles.modalStudent}
                        onClick={() => {
                          // 학생을 클리닉에 배치
                          assignStudent(student.id, day, time);
                        }}
                        title="클릭하여 배치"
                      >
                        <div className={pageStyles.modalStudentInfo}>
                          <div>
                            <span className={pageStyles.modalStudentSchool}>{student.school}</span>
                            <span className={pageStyles.modalStudentGrade}>{student.grade}</span>
                          </div>
                          <div className={pageStyles.modalStudentName}>
                            {student.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={pageStyles.emptyMessage}>미배치 학생이 없습니다.</p>
                )}
              </div>
            </div>
            <div className={pageStyles.modalFooterFullWidth}>
              {clinic && clinic.students.length > 0 ? (
                <>
                  <button
                    className={`${pageStyles.modalButtonFullWidth} ${pageStyles.resetButton} ${styles.modalButton} ${styles.resetButton}`}
                    onClick={handleResetClinic}
                  >
                    전체 초기화
                  </button>
                  <button
                    className={`${pageStyles.modalButtonFullWidth} ${pageStyles.closeButton} ${styles.modalButton}`}
                    onClick={handleCloseModal}
                  >
                    닫기
                  </button>
                </>
              ) : (
                <button
                  className={`${pageStyles.modalButtonFullWidth} ${pageStyles.closeButton}`}
                  onClick={handleCloseModal}
                  style={{ borderRadius: '0 0 12px 12px', height: '100%' }}
                >
                  닫기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 토스트 메시지 */}
      {showToast && (
        <div className={pageStyles.toast}>
          <p>{toastMessage}</p>
          <div>
            <button onClick={confirmReset}>확인</button>
            <button onClick={cancelReset}>닫기</button>
          </div>
        </div>
      )}
    </>
  );
};

export default ClinicCell; 