'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User } from './types'; // lib/types.ts에서 통합된 User 타입 사용

// 인증 컨텍스트 타입 정의
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsPasswordChange: boolean;
  login: (token: string, user: User, needsPasswordChange?: boolean) => void;
  logout: () => void;
  clearPasswordChangeFlag: () => void;
}

// 기본값으로 컨텍스트 생성
const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  needsPasswordChange: false,
  login: () => {},
  logout: () => {},
  clearPasswordChangeFlag: () => {},
});

// 인증 제공자 프롭스 타입 정의
interface AuthProviderProps {
  children: ReactNode;
}

// 인증 제공자 컴포넌트
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const router = useRouter();

  // 로컬 스토리지에서 사용자 정보 불러오기
  useEffect(() => {
    const loadUserFromStorage = () => {
      try {
        // 클라이언트 사이드에서만 localStorage 접근
        if (typeof window !== 'undefined') {
          const storedToken = localStorage.getItem('token');
          const storedUser = localStorage.getItem('user');
          
          if (storedToken && storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              setToken(storedToken);
              setUser(parsedUser);
            } catch (parseError) {
              console.error('Failed to parse user data:', parseError);
              // 파싱 오류 시 로컬 스토리지 정리
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            }
          }
        }
      } catch (error) {
        console.error('Failed to load user from storage:', error);
        // 오류 발생 시 로컬 스토리지 정리
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } finally {
        // 로딩 상태를 false로 설정하여 무한 로딩 방지
        setIsLoading(false);
      }
    };
    
    // 클라이언트 사이드에서만 실행하여 Hydration 에러 방지
    if (typeof window !== 'undefined') {
      loadUserFromStorage();
    } else {
      // 서버 사이드에서는 로딩만 false로 설정
      setIsLoading(false);
    }
  }, []); // 빈 의존성 배열로 한 번만 실행

  // 로그인 함수
  const login = (token: string, user: User, needsPasswordChange?: boolean) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
    setNeedsPasswordChange(needsPasswordChange || false);
  };

  // 로그아웃 함수
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setNeedsPasswordChange(false);
    router.push('/');
  };

  // 비밀번호 변경 플래그 초기화 함수
  const clearPasswordChangeFlag = () => {
    setNeedsPasswordChange(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        needsPasswordChange,
        login,
        logout,
        clearPasswordChangeFlag,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// 커스텀 훅: 인증 컨텍스트 사용
export function useAuth() {
  return useContext(AuthContext);
} 