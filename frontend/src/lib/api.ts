import axios from 'axios';
import { Student } from '@/components/student-placement/StudentItem';
import { Teacher } from '@/components/student-placement/TeacherBox';
import { log } from 'console';

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
    const response = await api.get('/users/?is_active=true&is_teacher=true&is_superuser=false');
    // console.log('API.TS', response);

    const teachers = Array.isArray(response.data) ? response.data : 
    (response.data.results ? response.data.results : []);
    // console.log(teachers);
    return teachers
    // results 필드가 있으면 해당 배열을 반환하고, 없으면 응답 자체를 배열로 변환합니다
  } catch (error) {
    console.error('선생님 데이터 가져오기 오류:', error);
    throw error;
  }
};

// 학생 배치 API
export const assignStudent = async (studentId: number, teacherId: number) => {
  try {
    console.log(`학생 배치 시도: 학생 ID ${studentId}, 선생님 ID ${teacherId}`);
    const response = await api.put(`/students/${studentId}/`, {
      assigned_teacher: teacherId
    });
    console.log('학생 배치 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('학생 배치 오류:', error);
    throw error;
  }
};

// 학생 미배치 API
export const unassignStudent = async (studentId: number) => {
  try {
    console.log(`학생 미배치 시도: 학생 ID ${studentId}`);
    const response = await api.put(`/students/${studentId}/`, {
      assigned_teacher: null
    });
    console.log('학생 미배치 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('학생 미배치 오류:', error);
    throw error;
  }
};

// 엑셀 파일로 학생 명단 업로드 API
export const uploadStudentExcel = async (file: File) => {
  try {
    console.log('엑셀 파일 업로드 시도:', file.name);
    
    // FormData 생성
    const formData = new FormData();
    formData.append('file', file);
    
    // multipart/form-data로 전송하기 위해 별도 axios 인스턴스 사용
    const response = await axios.post(`${API_URL}/students/upload-excel/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Token ${localStorage.getItem('token')}`,
      },
    });
    
    console.log('엑셀 업로드 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('엑셀 업로드 오류:', error);
    throw error;
  }
};

export default api; 