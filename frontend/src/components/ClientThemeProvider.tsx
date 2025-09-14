'use client';

// 클라이언트 전용 테마 프로바이더 컴포넌트
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

// 다크모드 설정을 위한 테마 구성
const config: ThemeConfig = {
  // 초기 색상 모드 설정 (light, dark, system)
  initialColorMode: 'light',
  // 시스템 색상 모드 사용 여부
  useSystemColorMode: false,
};

// Material Design 다크테마 가이드라인을 따른 간소화된 색상 팔레트
const colors = {
  // 브랜드 색상 정의
  brand: {
    50: '#e3f2f9',
    100: '#c5e4f3',
    200: '#a2d4ec',
    300: '#7ac1e4',
    400: '#47a9da',
    500: '#0088cc', // 메인 브랜드 색상
    600: '#007ab8',
    700: '#006ba1',
    800: '#005885',
    900: '#003f5e',
  },
  // Material Design Dark Theme Colors
  dark: {
    background: '#010101',     // 다크모드 메인 배경
    surface: '#010101',       // 컴포넌트 배경 1 
    surface2: '#242323',       // 컴포넌트 배경 2
    text: 'rgba(228, 228, 228, 0.95)',          // 텍스트 색상
    textSecondary: '#9AA0A6',  // 보조 텍스트
    border: '#3C4043',        // 테두리 색상
    hover: '#2D2E30',         // 호버 색상
  },
};

// 컴포넌트별 스타일 정의
const components = {
  // Button 컴포넌트 스타일
  Button: {
    variants: {
      // 네비게이션 버튼용 커스텀 variant
      nav: {
        color: 'white',
        bg: 'transparent',
        _hover: {
          bg: 'whiteAlpha.200',
        },
        _active: {
          bg: 'whiteAlpha.300',
        },
      },
    },
  },
  // Box 컴포넌트 스타일
  Box: {
    variants: {
      // 네비게이션 바용 스타일
      navbar: {
        bg: 'rgba(0, 0, 0, 0.85)',
        _dark: {
          bg: 'rgba(0, 0, 0, 0.95)',
        },
      },
    },
  },
};

// 전역 스타일 정의 (Material Design Dark Theme 적용)
const styles = {
  global: (props: any) => ({
    // body 스타일
    body: {
      bg: props.colorMode === 'dark' ? 'dark.background' : 'white',
      color: props.colorMode === 'dark' ? 'dark.text' : 'gray.800',
      transition: 'background-color 0.2s, color 0.2s',
    },
    // HTML 스타일
    html: {
      scrollBehavior: 'smooth',
    },
  }),
};

// 클라이언트에서만 테마 생성
const theme = extendTheme({
  config,
  colors,
  components,
  styles,
});

interface ClientThemeProviderProps {
  children: React.ReactNode;
}

export default function ClientThemeProvider({ children }: ClientThemeProviderProps) {
  return (
    <>
      {/* 다크모드 초기화 스크립트 */}
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme}>
        {children}
      </ChakraProvider>
    </>
  );
}
