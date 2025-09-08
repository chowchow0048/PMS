'use client';

// 다크모드 토글 버튼 컴포넌트
import { 
  IconButton, 
  useColorMode, 
  useColorModeValue,
  Tooltip 
} from '@chakra-ui/react';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';

interface ThemeToggleButtonProps {
  // 버튼 크기 설정 (sm, md, lg)
  size?: 'sm' | 'md' | 'lg';
  // 추가적인 스타일링을 위한 variant
  variant?: 'solid' | 'outline' | 'ghost';
}

export default function ThemeToggleButton({ 
  size = 'md', 
  variant = 'ghost' 
}: ThemeToggleButtonProps) {
  // Chakra UI의 useColorMode 훅 사용
  const { colorMode, toggleColorMode } = useColorMode();
  
  // 현재 색상 모드에 따라 아이콘과 색상 결정
  const SwitchIcon = useColorModeValue(MoonIcon, SunIcon);
  const iconColor = useColorModeValue('gray.600', 'yellow.400');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  
  // 토글 버튼 클릭 핸들러
  const handleToggle = () => {
    toggleColorMode();
  };

  // 키보드 접근성을 위한 핸들러
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  };

  return (
    <Tooltip 
      label={colorMode === 'light' ? '다크모드로 전환' : '라이트모드로 전환'}
      aria-label="테마 전환 툴팁"
      placement="bottom"
    >
      <IconButton
        aria-label={`현재 ${colorMode === 'light' ? '라이트' : '다크'}모드, 클릭하여 ${colorMode === 'light' ? '다크' : '라이트'}모드로 전환`}
        icon={<SwitchIcon />}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        variant={variant}
        size={size}
        color={iconColor}
        bg={useColorModeValue('transparent', 'transparent')}
        _hover={{
          bg: hoverBg,
          transform: 'scale(1.05)',
        }}
        _active={{
          transform: 'scale(0.95)',
        }}
        _focus={{
          outline: '2px solid',
          outlineColor: useColorModeValue('blue.500', 'blue.300'),
          outlineOffset: '2px',
        }}
        transition="all 0.2s ease-in-out"
        borderRadius="md"
      />
    </Tooltip>
  );
}
