import React from 'react';

export const metadata = {
  title: '마이페이지',
  description: '강사 마이페이지',
};

export default function MyPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section>
      {children}
    </section>
  );
} 