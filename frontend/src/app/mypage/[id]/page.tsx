'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import styles from './page.module.css';
import { ClinicProvider, useClinic } from './ClinicContext';
import ClinicCell from './ClinicCell';
import TodayClinic from './TodayClinic';
import { MyPageGuard } from '@/lib/authGuard';

// 강사 정보 타입 정의
interface Teacher {
  id: number;
  name: string;
}

// 저장 버튼 컴포넌트
const SaveButtonComponent: React.FC = () => {
  const { isLoading, saveChanges } = useClinic();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  // 저장 핸들러
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      await saveChanges();
      setSaveMessage('저장 완료');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage('저장 실패');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.saveButtonContainer}>
      <button 
        className={styles.saveButton} 
        onClick={handleSave}
        disabled={isLoading || isSaving}
      >
        {isSaving ? '저장 중...' : '변경사항 저장'}
      </button>
      {saveMessage && <span className={styles.saveMessage}>{saveMessage}</span>}
    </div>
  );
};

// 시간표 컴포넌트 (저장 버튼 제외)
const TimeTableWithoutSaveButton: React.FC = () => {
  const { isLoading, error, unassignedStudents } = useClinic();
  
  // 요일 배열
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  
  // 시간 배열 (10:00 ~ 22:00)
  const times = Array.from({ length: 13 }, (_, i) => `${i + 10}:00`);

  return (
    <>
      {error && <div className={styles.errorMessage}>{error}</div>}
      
      {isLoading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>클리닉 정보를 불러오는 중...</p>
        </div>
      ) : (
        <>
          <div className={styles.timetableContainer}>
            <table className={styles.timetable}>
              <thead>
                <tr>
                  <th className={styles.timeHeader}>시간</th>
                  {days.map((day) => (
                    <th key={day} className={styles.dayHeader}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {times.map((time) => (
                  <tr key={time}>
                    <td className={styles.timeCell}>{time}</td>
                    {days.map((day) => (
                      <td key={`${day}-${time}`} className={styles.tableCell}>
                        <ClinicCell day={day} time={time} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
};

// 마이페이지 컴포넌트 Props 타입 정의
interface MyPageProps {
  params: {
    id: string;
  };
}

// 마이페이지 컨텐츠 컴포넌트 (권한 체크 후 렌더링)
const MyPageContent: React.FC<MyPageProps> = ({ params }) => {
  // 동적 경로에서 ID 추출
  const userId = params.id;
  
  // 강사 정보 상태
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 페이지 모드 상태 (시간표 vs 오늘의 클리닉)
  const [currentPage, setCurrentPage] = useState<'timetable' | 'today'>('timetable');

  // 강사 정보 가져오기
  useEffect(() => {
    const fetchTeacherData = async () => {
      console.log('MyPageContent: 데이터 가져오기 시작', { userId, params });
      
      setIsLoading(true);
      setError(null);
      
      try {
        // URL 디코딩 처리
        const decodedUserId = decodeURIComponent(userId);
        console.log('MyPageContent: 디코딩된 userId', { userId, decodedUserId });
        
        // 잘못된 userId 체크
        if (decodedUserId === '[id]' || userId.includes('%5B') || userId.includes('[')) {
          console.error('MyPageContent: 잘못된 userId 감지', { userId, decodedUserId });
          setError('잘못된 페이지 경로입니다.');
          setIsLoading(false);
          return;
        }
        
        // 숫자가 아닌 ID 체크
        if (!/^\d+$/.test(decodedUserId)) {
          console.error('MyPageContent: 유효하지 않은 userId', { userId, decodedUserId });
          setError('유효하지 않은 사용자 ID입니다.');
          setIsLoading(false);
          return;
        }
        
        // 토큰 확인
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('MyPageContent: 인증 정보가 없습니다.');
          setError('인증 정보가 없습니다. 다시 로그인해주세요.');
          setIsLoading(false);
          return;
        }

        // 사용자 정보 가져오기 (백엔드 API 경로 사용)
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
        const apiUrl = `${API_URL}/mypage/${decodedUserId}/`;
        console.log('MyPageContent: API 호출 준비', { 
          apiUrl, 
          token: token.substring(0, 10) + '...',
          decodedUserId 
        });
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        console.log('MyPageContent: API 응답 받음', { 
          status: response.status, 
          statusText: response.statusText,
          ok: response.ok,
          url: response.url
        });
        
        if (!response.ok) {
          let errorMessage = `API 요청 실패 (${response.status})`;
          
          try {
            const errorData = await response.json();
            console.error('MyPageContent: API 에러 데이터', errorData);
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch (parseError) {
            const errorText = await response.text();
            console.error('MyPageContent: API 에러 텍스트', errorText);
            errorMessage = errorText || errorMessage;
          }
          
          if (response.status === 403) {
            errorMessage = '이 페이지에 접근할 권한이 없습니다.';
          } else if (response.status === 404) {
            errorMessage = '사용자를 찾을 수 없습니다.';
          } else if (response.status === 401) {
            errorMessage = '인증이 만료되었습니다. 다시 로그인해주세요.';
          }
          
          throw new Error(errorMessage);
        }
        
        const userData = await response.json();
        console.log('MyPageContent: 사용자 데이터 받음', {
          userData,
          hasUser: !!userData.user,
          userId: userData.user?.id,
          userName: userData.user?.user_name || userData.user?.username
        });
        
        if (!userData.user) {
          throw new Error('사용자 데이터가 없습니다.');
        }
        
        setTeacher({ 
          id: userData.user.id, 
          name: userData.user.user_name || userData.user.username 
        });
        
        console.log('MyPageContent: 강사 정보 설정 완료', {
          id: userData.user.id,
          name: userData.user.user_name || userData.user.username
        });
        
      } catch (error) {
        console.error('MyPageContent: 데이터 가져오기 실패:', error);
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    // userId가 유효한 경우에만 데이터 가져오기
    if (userId && userId !== '[id]') {
      fetchTeacherData();
    } else {
      console.error('MyPageContent: 유효하지 않은 userId로 인해 데이터 가져오기 건너뜀', { userId });
      setError('유효하지 않은 페이지 경로입니다.');
      setIsLoading(false);
    }
  }, [userId]);

  // 에러 상태 표시
  if (error) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.errorMessage}>
          <h2>오류가 발생했습니다</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>페이지 새로고침</button>
        </div>
      </div>
    );
  }

  // 데이터 로딩 중일 때 로딩 표시
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>페이지를 불러오는 중...</p>
      </div>
    );
  }

  // 강사 정보가 없는 경우
  if (!teacher) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.errorMessage}>
          <h2>사용자 정보를 찾을 수 없습니다</h2>
          <p>요청하신 사용자의 정보를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  // 페이지 전환 핸들러
  const handlePageToggle = () => {
    setCurrentPage(prev => prev === 'timetable' ? 'today' : 'timetable');
  };

  return (
    <ClinicProvider>
      <div className={styles.pageContainer}>
        {/* 강사 이름과 저장 버튼을 같은 선상에 배치 */}
        {currentPage === 'timetable' && (
          <div className={styles.headerContainer}>
            <div className={styles.teacherHeader}>
              강사 {teacher.name}
            </div>
            <SaveButtonComponent />
          </div>
        )}
        
        {/* 페이지 전환 버튼 */}
        <button
          className={`${styles.pageToggleButton} ${
            currentPage === 'timetable' 
              ? styles.pageToggleButtonRight 
              : styles.pageToggleButtonLeft
          }`}
          onClick={handlePageToggle}
          title={currentPage === 'timetable' ? '오늘의 클리닉 보기' : '시간표 보기'}
        >
          {currentPage === 'timetable' ? '>' : '<'}
        </button>
        
        {/* 현재 페이지에 따른 컨텐츠 렌더링 */}
        <div className={`${styles.pageContent} ${
          currentPage === 'timetable' ? styles.slideInLeft : styles.slideInRight
        }`}>
          {currentPage === 'timetable' ? (
            <TimeTableWithoutSaveButton />
          ) : (
            <TodayClinic />
          )}
        </div>
      </div>
    </ClinicProvider>
  );
};

// MyPageGuard로 감싸서 권한 체크를 적용한 마이페이지 컴포넌트
const MyPage: React.FC<MyPageProps> = ({ params }) => {
  return (
    <MyPageGuard pageUserId={params.id}>
      <MyPageContent params={params} />
    </MyPageGuard>
  );
};

export default MyPage; 