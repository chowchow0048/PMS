import axios from 'axios';
import { Student, User } from '@/lib/types'; // types.ts에서 Student와 User import
// import { Teacher } from '@/components/student-placement/TeacherBox';  // 보충 시스템 개편으로 주석처리

// 보충 시스템 개편으로 임시 Teacher 타입 정의 (기존 코드 유지를 위해)
type Teacher = {
  id: number;
  user_name: string;
  user_subject: any;
  max_student_num: number;
  is_teacher: boolean;
  is_staff: boolean;
  is_superuser: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// API 요청에 인증 토큰을 포함하는 axios 인스턴스 생성
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 추가
api.interceptors.request.use(
  (config) => {
    // 클라이언트 사이드에서만 localStorage 접근
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Token ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 추가
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API 에러:', error);
    
    // 401 Unauthorized 응답 처리
    if (error.response?.status === 401) {
      const errorData = error.response?.data;
      
      // 클라이언트 사이드에서만 처리
      if (typeof window !== 'undefined') {
        // 중복 로그인 감지 시 특별 처리
        if (errorData?.error === 'session_expired' || errorData?.reason === 'duplicate_login') {
          console.warn('🚨 중복 로그인 감지:', errorData);
          
          // localStorage 정리
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          // 사용자에게 알림 표시 (토스트 또는 알림창)
          const message = errorData?.message || '다른 곳에서 로그인하여 자동으로 로그아웃되었습니다.';
          
          // 브라우저 알림 표시
          if (window.confirm(`${message}\n\n로그인 페이지로 이동하시겠습니까?`)) {
            window.location.href = '/login';
          } else {
            // 사용자가 취소를 눌러도 로그인 페이지로 이동
            setTimeout(() => {
              window.location.href = '/login';
            }, 2000);
          }
          
          return Promise.reject(new Error('duplicate_login_detected'));
        }
        
        // 일반적인 인증 오류 (토큰 만료 등)
        console.warn('🔐 인증 오류 - 로그인 필요');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // 조용히 로그인 페이지로 리다이렉트
        window.location.href = '/login';
      }
    }
    
    // 기타 오류는 그대로 전파
    return Promise.reject(error);
  }
);

// 로그인 API
export const login = async (username: string, password: string) => {
  try {
    console.log('로그인 시도:', { username });
    const response = await api.post('/auth/login/', { username, password });
    console.log('로그인 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('로그인 에러:', error);
    throw error;
  }
};

// 로그아웃 API
export const logout = async () => {
  try {
    await api.post('/auth/logout/');
    localStorage.removeItem('token');
  } catch (error) {
    console.error('로그아웃 에러:', error);
  }
};

// 학생 배치 데이터 가져오기
export const fetchStudentPlacementData = async () => {
  try {
    const response = await api.get('/student-placement/');
    return response.data;
  } catch (error) {
    console.error('학생 배치 데이터 가져오기 에러:', error);
    throw error;
  }
};

// 사용자 정보 가져오기
export const fetchUserData = async () => {
  try {
    const response = await api.get('/users/');
    return response.data;
  } catch (error) {
    console.error('사용자 정보 가져오기 에러:', error);
    throw error;
  }
};

// 회원가입 API
export const register = async (userData: any) => {
  try {
    const response = await api.post('/auth/register/', userData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 모든 학생 가져오기 (is_student=true인 User들)
export const getStudents = async (): Promise<Student[]> => {
  try {
    console.log('🔍 [api.ts] getStudents 함수 시작 - User 기반 (is_student=true)');
    
    let allStudents: any[] = []; // 모든 학생 데이터를 담을 배열
    let nextUrl: string | null = '/users/?is_student=true&page_size=100'; // User 엔드포인트로 변경
    
    // 모든 페이지를 순회하여 데이터 수집
    while (nextUrl) {
      const response: any = await api.get(nextUrl);
      console.log('🔍 [api.ts] User(is_student=true) 응답:', response);
      
      // 현재 페이지의 학생 데이터 추가
      if (Array.isArray(response.data)) {
        // 페이지네이션이 없는 경우 (전체 배열 반환)
        allStudents = response.data;
        break;
      } else if (response.data.results) {
        // 페이지네이션이 있는 경우
        allStudents = allStudents.concat(response.data.results);
        
        // 다음 페이지 URL 설정
        if (response.data.next) {
          // 다음 페이지 URL에서 base URL 제거하고 경로만 추출
          nextUrl = response.data.next.replace(api.defaults.baseURL || '', '');
        } else {
          nextUrl = null; // 더 이상 페이지가 없으면 종료
        }
      } else {
        // 예상치 못한 응답 형식
        console.warn('예상치 못한 응답 형식:', response.data);
        break;
      }
    }
    
    // User 데이터를 Student 인터페이스에 맞게 변환
    const students: Student[] = allStudents.map((user: any) => ({
      ...user,
      student_name: user.name, // name을 student_name으로 매핑 (기존 코드 호환성)
      is_student: true,
      student_phone_num: user.student_phone_num || '',
      student_parent_phone_num: user.student_parent_phone_num || '',
      school: user.school || '',
      grade: user.grade || '',
    }));
    
    console.log(`🔍 [api.ts] 전체 학생 수: ${students.length}명`);
    return students;
  } catch (error) {
    console.error('❌ [api.ts] 학생 데이터 가져오기 오류:', error);
    throw error;
  }
};

// 모든 선생님 가져오기 (is_teacher=true인 User들)
export const getTeachers = async () => {
  try {
    console.log('🔍 [api.ts] getTeachers 함수 시작 - User 기반 (is_teacher=true)');
    console.log('🔍 [api.ts] API_URL:', API_URL);
    console.log('🔍 [api.ts] 요청 URL:', `${API_URL}/users/?is_active=true&is_teacher=true&is_superuser=false`);
    
    // 토큰 확인
    const token = localStorage.getItem('token');
    console.log('🔍 [api.ts] 토큰 존재 여부:', !!token);
    console.log('🔍 [api.ts] 토큰 앞 10자리:', token ? token.substring(0, 10) + '...' : 'null');
    
    const response = await api.get('/users/?is_active=true&is_teacher=true&is_superuser=false');
    console.log('🔍 [api.ts] API 응답 성공:', response.status);
    console.log('🔍 [api.ts] 응답 데이터 타입:', typeof response.data);
    console.log('🔍 [api.ts] 응답 데이터:', response.data);

    const users = Array.isArray(response.data) ? response.data : 
                  (response.data.results ? response.data.results : []);
    
    // User 데이터를 Teacher 인터페이스에 맞게 변환
    const teachers = users.map((user: any) => ({
      ...user,
      user_name: user.name, // name을 user_name으로 매핑 (기존 코드 호환성)
      user_subject: user.subject, // subject를 user_subject로 매핑
      max_student_num: 20, // 기본값 설정 (향후 User 모델에 추가 필요시 수정)
    }));
    
    console.log('🔍 [api.ts] 처리된 선생님 데이터:', teachers);
    console.log('🔍 [api.ts] 선생님 수:', teachers.length);
    
    return teachers;
  } catch (error) {
    console.error('❌ [api.ts] getTeachers 함수에서 오류 발생:');
    console.error('❌ [api.ts] 오류 타입:', error?.constructor?.name);
    console.error('❌ [api.ts] 오류 메시지:', (error as any)?.message);
    console.error('❌ [api.ts] 오류 코드:', (error as any)?.code);
    console.error('❌ [api.ts] 오류 설정:', (error as any)?.config);
    console.error('❌ [api.ts] 전체 오류 객체:', error);
    throw error;
  }
};

// 임시 더미 함수들 (기존 코드 호환성을 위해)
export const assignStudent = async (studentId: number, teacherId: number) => {
  console.warn('assignStudent: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
  return { deprecated: true };
};

export const unassignStudent = async (studentId: number) => {
  console.warn('unassignStudent: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
  return { deprecated: true };
};

// 엑셀 파일로 학생 명단 업로드 API (User 기반으로 수정)
export const uploadStudentExcel = async (file: File) => {
  try {
    console.log('🔍 [api.ts] 학생 명단 엑셀 파일 업로드 시도:', file.name);
    console.log('🔍 [api.ts] 파일 크기:', file.size, 'bytes');
    console.log('🔍 [api.ts] 파일 타입:', file.type);
    
    // FormData 생성
    const formData = new FormData();
    formData.append('file', file);
    console.log('🔍 [api.ts] FormData 생성 완료');
    
    // multipart/form-data로 전송하기 위해 별도 axios 인스턴스 사용
    const token = localStorage.getItem('token');
    console.log('🔍 [api.ts] 토큰 확인:', token ? '있음' : '없음');
    
    console.log('🔍 [api.ts] API 요청 시작...');
    // User 엔드포인트로 변경
    const response = await axios.post(`${API_URL}/users/upload-student-excel/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Token ${token}`,
      },
    });
    
    console.log('🔍 [api.ts] API 응답 수신:', response.status);
    console.log('🔍 [api.ts] 학생 명단 엑셀 업로드 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ [api.ts] 학생 명단 엑셀 업로드 오류:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      console.error('❌ [api.ts] 응답 상태:', axiosError.response?.status);
      console.error('❌ [api.ts] 응답 데이터:', axiosError.response?.data);
    }
    throw error;
  }
};

// 모든 클리닉 가져오기
export const getClinics = async () => {
  try {
    console.log('🔍 [api.ts] getClinics 함수 시작');
    
    const response = await api.get('/clinics/');
    console.log('🔍 [api.ts] 클리닉 데이터 로딩 완료:', response.data);
    
    const clinics = Array.isArray(response.data) ? response.data : 
                   (response.data.results ? response.data.results : []);
    
    console.log('🔍 [api.ts] 처리된 클리닉 데이터:', clinics);
    return clinics;
  } catch (error) {
    console.error('❌ [api.ts] getClinics 함수에서 오류 발생:', error);
    throw error;
  }
};

// 특정 요일의 클리닉 가져오기
export const getClinicsByDay = async (day: string) => {
  try {
    console.log('🔍 [api.ts] getClinicsByDay 함수 시작:', day);
    
    const response = await api.get(`/clinics/?clinic_day=${day}`);
    console.log('🔍 [api.ts] 요일별 클리닉 데이터 로딩 완료:', response.data);
    
    const clinics = Array.isArray(response.data) ? response.data : 
                   (response.data.results ? response.data.results : []);
    
    return clinics;
  } catch (error) {
    console.error('❌ [api.ts] getClinicsByDay 함수에서 오류 발생:', error);
    throw error;
  }
};

// 클리닉 업데이트 (학생 배치 관련)
export const updateClinic = async (clinicId: number, clinicData: any) => {
  try {
    console.log('🔍 [api.ts] updateClinic 함수 시작:', clinicId, clinicData);
    
    const response = await api.put(`/clinics/${clinicId}/`, clinicData);
    console.log('🔍 [api.ts] 클리닉 업데이트 완료:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ [api.ts] updateClinic 함수에서 오류 발생:', error);
    throw error;
  }
};

// 클리닉 생성
export const createClinic = async (clinicData: any) => {
  try {
    console.log('🔍 [api.ts] createClinic 함수 시작:', clinicData);
    
    const response = await api.post('/clinics/', clinicData);
    console.log('🔍 [api.ts] 클리닉 생성 완료:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ [api.ts] createClinic 함수에서 오류 발생:', error);
    throw error;
  }
};

// 클리닉에 학생 배치 API (Student 배치를 clinic_students에 직접 추가)
export const assignStudentToClinic = async (clinicId: number, studentIds: number[]) => {
  try {
    console.log('🔍 [api.ts] assignStudentToClinic 함수 시작:', clinicId, studentIds);
    
    // 클리닉 정보 가져오기
    const clinicResponse = await api.get(`/clinics/${clinicId}/`);
    const clinic = clinicResponse.data;
    
    console.log('🔍 [api.ts] 현재 클리닉 정보:', clinic);
    
    // 기존 학생 ID 목록 추출 (clinic_students는 User 객체 배열)
    const existingStudentIds = clinic.clinic_students?.map((user: any) => user.id) || [];
    console.log('🔍 [api.ts] 기존 학생 ID들:', existingStudentIds);
    
    // 새 학생 ID들과 기존 학생 ID들을 합치되, 중복 제거
    const updatedStudentIds = Array.from(new Set([...existingStudentIds, ...studentIds]));
    console.log('🔍 [api.ts] 업데이트될 학생 ID들:', updatedStudentIds);
    
    // 클리닉 업데이트 (clinic_students에 학생 ID 배열 전송)
    const response = await api.put(`/clinics/${clinicId}/`, {
      ...clinic,
      clinic_students: updatedStudentIds // User ID 배열로 전송
    });
    
    console.log('🔍 [api.ts] 학생 클리닉 배치 완료:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ [api.ts] assignStudentToClinic 함수에서 오류 발생:', error);
    throw error;
  }
};

// 오늘의 클리닉 정보 가져오기
export const getTodayClinic = async () => {
  try {
    console.log('🔍 [api.ts] getTodayClinic 함수 시작');
    const response = await api.get('/today-clinic/');
    console.log('🔍 [api.ts] 오늘의 클리닉 API 응답 성공:', response.status);
    console.log('🔍 [api.ts] 오늘의 클리닉 데이터:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ [api.ts] 오늘의 클리닉 정보 가져오기 오류:', error);
    throw error;
  }
};

// ============= 클리닉 출석 관련 API 함수들 =============

// 출석 상태 타입 정의
type AttendanceType = 'attended' | 'absent' | 'sick' | 'late' | 'none';

// 특정 클리닉의 출석 데이터 조회
export const getClinicAttendances = async (clinicId: number, date?: string) => {
  try {
    console.log(`🔍 [api.ts] getClinicAttendances 시작 - 클리닉 ID: ${clinicId}, 날짜: ${date || '오늘'}`);
    
    const params: any = { clinic_id: clinicId };
    if (date) {
      params.date = date;
    }
    
    const response = await api.get('/clinic-attendances/', { params });
    
    console.log('✅ [api.ts] 출석 데이터 조회 완료:', response.data);
    
    // 페이지네이션된 응답에서 results 배열 반환
    const attendances = Array.isArray(response.data) ? response.data : 
                       (response.data.results ? response.data.results : []);
    
    console.log('📋 [api.ts] 처리된 출석 데이터 배열:', attendances);
    return attendances;
  } catch (error) {
    console.error('❌ [api.ts] 출석 데이터 조회 오류:', error);
    throw error;
  }
};

// 출석 상태 업데이트
export const updateAttendance = async (attendanceId: number, attendanceType: AttendanceType) => {
  try {
    console.log(`🔍 [api.ts] updateAttendance 시작 - ID: ${attendanceId}, 상태: ${attendanceType}`);
    
    const response = await api.patch(`/clinic-attendances/${attendanceId}/update_attendance/`, {
      attendance_type: attendanceType
    });
    
    console.log('✅ [api.ts] 출석 상태 업데이트 완료:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ [api.ts] 출석 상태 업데이트 오류:', error);
    throw error;
  }
};

// 출석 데이터 직접 생성 (개별 학생용)
export const createAttendance = async (clinicId: number, studentId: number, attendanceType: AttendanceType = 'none') => {
  try {
    console.log(`🔍 [api.ts] createAttendance 시작 - 클리닉: ${clinicId}, 학생: ${studentId}, 상태: ${attendanceType}`);
    
    const response = await api.post('/clinic-attendances/', {
      clinic: clinicId,
      student: studentId,
      attendance_type: attendanceType
    });
    
    console.log('✅ [api.ts] 출석 데이터 생성 완료:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ [api.ts] 출석 데이터 생성 오류:', error);
    throw error;
  }
};

// 특정 클리닉+학생 조합의 출석 데이터 조회 또는 생성
export const getOrCreateAttendance = async (clinicId: number, studentId: number) => {
  try {
    console.log(`🔍 [api.ts] getOrCreateAttendance 시작 - 클리닉: ${clinicId}, 학생: ${studentId}`);
    
    // 먼저 기존 출석 데이터 조회 (이제 배열을 반환함)
    const existingAttendances = await getClinicAttendances(clinicId);
    console.log(`📋 [api.ts] 기존 출석 데이터 조회 결과: ${existingAttendances.length}개`);
    
    const existingAttendance = existingAttendances.find((att: any) => att.student === studentId);
    
    if (existingAttendance) {
      console.log('📋 [api.ts] 기존 출석 데이터 발견:', existingAttendance);
      return existingAttendance;
    }
    
    // 없으면 새로 생성
    console.log('📝 [api.ts] 출석 데이터 새로 생성');
    return await createAttendance(clinicId, studentId, 'none');
    
  } catch (error) {
    console.error('❌ [api.ts] getOrCreateAttendance 오류:', error);
    throw error;
  }
};


// 클리닉 예약 취소 API
export const cancelClinicReservation = async (userId: number, clinicId: number) => {
  try {
    console.log('🔍 [api.ts] cancelClinicReservation 함수 시작:', { userId, clinicId });
    
    const response = await api.post('/clinics/cancel_reservation/', {
      user_id: userId,
      clinic_id: clinicId,
    });
    
    console.log('✅ [api.ts] 클리닉 예약 취소 완료:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ [api.ts] 클리닉 예약 취소 오류:', error);
    
    // 백엔드 에러 응답 처리
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      console.error('❌ [api.ts] 응답 상태:', axiosError.response?.status);
      console.error('❌ [api.ts] 응답 데이터:', axiosError.response?.data);
      
      // 당일 취소 불가 에러인 경우 특별 처리
      if (axiosError.response?.status === 403 && 
          axiosError.response?.data?.error === 'same_day_cancellation_not_allowed') {
        throw new Error('SAME_DAY_CANCELLATION_NOT_ALLOWED');
      }
    }
    
    throw error;
  }
};

// 클리닉 예약 API
export const reserveClinic = async (userId: number, clinicId: number) => {
  try {
    console.log('🔍 [api.ts] reserveClinic 함수 시작:', { userId, clinicId });
    
    const response = await api.post('/clinics/reserve_clinic/', {
      user_id: userId,
      clinic_id: clinicId,
    });
    
    console.log('✅ [api.ts] 클리닉 예약 완료:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ [api.ts] 클리닉 예약 오류:', error);
    throw error;
  }
};

export default api; 