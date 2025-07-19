import axios from 'axios';
import { Student } from '@/components/student-placement/StudentItem';
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
    if (error.response?.status === 401) {
      // 토큰이 만료되었거나 유효하지 않은 경우
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
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

// 모든 학생 가져오기
export const getStudents = async () => {
  try {
    let allStudents: any[] = []; // 모든 학생 데이터를 담을 배열
    let nextUrl: string | null = '/students/?page_size=100'; // 첫 번째 페이지 URL
    
    // 모든 페이지를 순회하여 데이터 수집
    while (nextUrl) {
      const response: any = await api.get(nextUrl);
      console.log('response', response);
      
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
    
    console.log(`전체 학생 수: ${allStudents.length}명`);
    return allStudents;
  } catch (error) {
    console.error('학생 데이터 가져오기 오류:', error);
    throw error;
  }
};

// 모든 선생님 가져오기
export const getTeachers = async () => {
  try {
    console.log('🔍 [api.ts] getTeachers 함수 시작');
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

    const teachers = Array.isArray(response.data) ? response.data : 
    (response.data.results ? response.data.results : []);
    console.log('🔍 [api.ts] 처리된 선생님 데이터:', teachers);
    console.log('🔍 [api.ts] 선생님 수:', teachers.length);
    
    return teachers
    // results 필드가 있으면 해당 배열을 반환하고, 없으면 응답 자체를 배열로 변환합니다
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

// 보충 시스템 개편으로 주석처리 - 더 이상 개별 배치 개념 없음
// // 학생 배치 API
// export const assignStudent = async (studentId: number, teacherId: number) => {
//   try {
//     console.log(`학생 배치 시도: 학생 ID ${studentId}, 선생님 ID ${teacherId}`);
//     const response = await api.put(`/students/${studentId}/`, {
//       assigned_teacher: teacherId
//     });
//     console.log('학생 배치 응답:', response.data);
//     return response.data;
//   } catch (error) {
//     console.error('학생 배치 오류:', error);
//     throw error;
//   }
// };

// // 학생 미배치 API
// export const unassignStudent = async (studentId: number) => {
//   try {
//     console.log(`학생 미배치 시도: 학생 ID ${studentId}`);
//     const response = await api.put(`/students/${studentId}/`, {
//       assigned_teacher: null
//     });
//     console.log('학생 미배치 응답:', response.data);
//     return response.data;
//   } catch (error) {
//     console.error('학생 미배치 오류:', error);
//     throw error;
//   }
// };

// 임시 더미 함수들 (기존 코드 호환성을 위해)
export const assignStudent = async (studentId: number, teacherId: number) => {
  console.warn('assignStudent: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
  return { deprecated: true };
};

export const unassignStudent = async (studentId: number) => {
  console.warn('unassignStudent: 보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다.');
  return { deprecated: true };
};

// 엑셀 파일로 학생 명단 업로드 API
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
    const response = await axios.post(`${API_URL}/students/upload-excel/`, formData, {
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

// 보충 신청 엑셀 파일 업로드 API
export const uploadClinicEnrollmentExcel = async (file: File) => {
  try {
    console.log('🔍 [api.ts] 보충 신청 엑셀 파일 업로드 시도:', file.name);
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
    const response = await axios.post(`${API_URL}/clinics/upload-enrollment/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Token ${token}`,
      },
    });
    
    console.log('🔍 [api.ts] API 응답 수신:', response.status);
    console.log('🔍 [api.ts] 보충 신청 엑셀 업로드 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ [api.ts] 보충 신청 엑셀 업로드 오류:', error);
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

// 클리닉에 학생 배치 API (미배치 상태에서 특정 클리닉의 미배치 영역으로 배치)
export const assignStudentToClinic = async (clinicId: number, studentIds: number[]) => {
  try {
    console.log('🔍 [api.ts] assignStudentToClinic 함수 시작:', clinicId, studentIds);
    
    // 클리닉 정보 가져오기
    const clinicResponse = await api.get(`/clinics/${clinicId}/`);
    const clinic = clinicResponse.data;
    
    // 기존 미배치 학생 ID 목록에 새 학생 ID들 추가
    const updatedUnassignedStudents = [...clinic.clinic_unassigned_students, ...studentIds];
    
    // 클리닉 업데이트
    const response = await api.put(`/clinics/${clinicId}/`, {
      ...clinic,
      clinic_unassigned_students: updatedUnassignedStudents
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

export default api; 