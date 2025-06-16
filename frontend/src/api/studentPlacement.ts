import axios from 'axios';
import { Student, Teacher, Subject, StudentPlacement } from '../types/studentPlacement';

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
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
    if (error.response?.status === 401) {
      // 토큰이 만료되었거나 유효하지 않은 경우
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const fetchStudentPlacementData = async (): Promise<{
  students: Student[];
  teachers: Teacher[];
  subjects: Subject[];
  placements: StudentPlacement[];
}> => {
  try {
    const response = await api.get('/student-placement/');
    return response.data;
  } catch (error) {
    console.error('Error fetching student placement data:', error);
    throw error;
  }
};

export const updateStudentPlacements = async (placements: StudentPlacement[]): Promise<StudentPlacement[]> => {
  try {
    const response = await api.post('/student-placement/update_placements/', {
      placements: placements.map(placement => ({
        student: placement.student.id,
        teacher: placement.teacher.id,
        subject: placement.subject.id
      }))
    });
    return response.data;
  } catch (error) {
    console.error('Error updating student placements:', error);
    throw error;
  }
};

export const login = async (username: string, password: string) => {
  try {
    const response = await api.post('/auth/login/', { username, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    return user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await api.post('/auth/logout/');
    localStorage.removeItem('token');
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/users/me/');
    return response.data;
  } catch (error) {
    console.error('Get current user error:', error);
    throw error;
  }
}; 