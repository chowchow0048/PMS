'use client';

import React from 'react';
import { Container, VStack, Heading, Text, Icon } from '@chakra-ui/react';
import { MdConstruction } from 'react-icons/md';

// 마이페이지 컴포넌트 Props 타입 정의
interface MyPageProps {
  params: {
    id: string;
  };
}

// 준비중 표시 마이페이지 컴포넌트
const MyPage: React.FC<MyPageProps> = ({ params }) => {
  return (
    <Container maxW="container.xl" py={16}>
      <VStack spacing={8} textAlign="center">
        <Icon as={MdConstruction} boxSize={20} color="orange.400" />
        <Heading as="h1" size="xl" color="gray.700">
          마이페이지 준비중
        </Heading>
        <Text fontSize="lg" color="gray.600" maxW="md">
          현재 마이페이지를 새롭게 구성하고 있습니다.
          <br />
          빠른 시일 내에 업데이트 예정입니다.
        </Text>
      </VStack>
    </Container>
  );
};

export default MyPage; 