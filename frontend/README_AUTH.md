# 권한 기반 라우팅 시스템

## 개요

PMS 시스템에서 사용자 권한에 따른 페이지 접근 제어 및 자동 리다이렉트 기능을 구현했습니다.

## 사용자 권한 분류

### 1. 관리자 (Admin)

- **조건**: `user.is_superuser === true` 또는 `user.is_staff === true`
- **접근 가능 페이지**:
  - 학생 배치 페이지 (`/student-placement`)
  - 모든 사용자의 마이페이지 (`/mypage/[id]`)
- **기본 리다이렉트**: `/student-placement`

### 2. 일반 강사 (Teacher)

- **조건**: `user.is_teacher === true && !user.is_staff && !user.is_superuser`
- **접근 가능 페이지**:
  - 자신의 마이페이지만 (`/mypage/${user.id}`)
- **기본 리다이렉트**: `/mypage/${user.id}`
- **제한사항**:
  - 학생 배치 페이지 접근 시 자신의 마이페이지로 리다이렉트
  - 다른 사용자의 마이페이지 접근 시 자신의 마이페이지로 리다이렉트

### 3. 학생 (Student)

- **조건**: 위 조건에 해당하지 않는 사용자
- **접근 가능 페이지**: 기본적으로 학생 배치 페이지
- **기본 리다이렉트**: `/student-placement`

## 구현된 컴포넌트

### 1. AuthGuard

**파일**: `frontend/src/lib/authGuard.tsx`

기본적인 권한 체크를 수행하는 컴포넌트입니다.

```tsx
<AuthGuard allowedRoles={["admin"]}>
  <AdminOnlyComponent />
</AuthGuard>
```

**Props**:

- `allowedRoles`: 허용된 사용자 역할 배열
- `requireAuth`: 인증 필요 여부 (기본값: true)
- `redirectTo`: 권한이 없을 때 리다이렉트할 경로

### 2. MyPageGuard

**파일**: `frontend/src/lib/authGuard.tsx`

마이페이지 전용 권한 체크 컴포넌트입니다.

```tsx
<MyPageGuard pageUserId={params.id}>
  <MyPageContent />
</MyPageGuard>
```

**기능**:

- 사용자는 자신의 마이페이지만 접근 가능
- 관리자는 모든 마이페이지 접근 가능
- 권한이 없으면 자신의 마이페이지로 리다이렉트

### 3. HOC (Higher-Order Components)

편의를 위한 HOC들을 제공합니다:

```tsx
// 관리자 전용
export const AdminOnlyPage = withAdminAuth(MyComponent);

// 강사 전용
export const TeacherOnlyPage = withTeacherAuth(MyComponent);

// 관리자 또는 강사
export const AdminOrTeacherPage = withAdminOrTeacherAuth(MyComponent);
```

## 적용된 페이지

### 1. 학생 배치 페이지 (`/student-placement`)

```tsx
export default function StudentPlacementPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <StudentPlacementPageContent />
    </AuthGuard>
  );
}
```

### 2. 마이페이지 (`/mypage/[id]`)

```tsx
export default function MyPage({ params }) {
  return (
    <MyPageGuard pageUserId={params.id}>
      <MyPageContent params={params} />
    </MyPageGuard>
  );
}
```

### 3. 루트 페이지 (`/`)

사용자 권한에 따른 자동 리다이렉트:

- 관리자 → `/student-placement`
- 일반 강사 → `/mypage/${user.id}`
- 비활성화 계정 → `/404` (토스트 메시지와 함께)

## 네비게이션 메뉴

### 데스크톱 메뉴

- 관리자: "학생 배치", "마이페이지", "로그아웃"
- 일반 강사: "마이페이지", "로그아웃"

### 모바일 드로어 메뉴

동일한 권한 기반 메뉴 구조를 제공합니다.

## 보안 기능

### 1. 토스트 메시지

권한이 없는 페이지 접근 시 사용자에게 명확한 메시지를 표시합니다:

- "접근 권한 없음"
- "이 페이지에 접근할 권한이 없습니다"
- "계정이 비활성화되었습니다"

### 2. 자동 리다이렉트

권한이 없는 경우 적절한 페이지로 자동 리다이렉트됩니다:

- 일반 강사가 학생 배치 페이지 접근 → 자신의 마이페이지
- 다른 사용자의 마이페이지 접근 → 자신의 마이페이지
- 비로그인 사용자 → 로그인 페이지

### 3. 로딩 상태 관리

권한 체크 중에는 로딩 스피너를 표시하여 사용자 경험을 개선합니다.

## 사용 예시

### 새로운 권한 보호 페이지 만들기

1. **관리자 전용 페이지**:

```tsx
import { AuthGuard } from "@/lib/authGuard";

export default function AdminPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <AdminContent />
    </AuthGuard>
  );
}
```

2. **강사 전용 페이지**:

```tsx
import { AuthGuard } from "@/lib/authGuard";

export default function TeacherPage() {
  return (
    <AuthGuard allowedRoles={["teacher"]}>
      <TeacherContent />
    </AuthGuard>
  );
}
```

3. **HOC 사용**:

```tsx
import { withAdminAuth } from "@/lib/authGuard";

const AdminComponent = () => <div>관리자 전용 컨텐츠</div>;

export default withAdminAuth(AdminComponent);
```

## 주의사항

1. **서버 사이드 검증**: 클라이언트 사이드 권한 체크는 UX 개선을 위한 것이며, 서버 사이드에서도 반드시 권한을 검증해야 합니다.

2. **토큰 만료**: API 인터셉터에서 401 에러 시 자동으로 로그인 페이지로 리다이렉트됩니다.

3. **계정 비활성화**: `user.is_activated === false`인 경우 모든 페이지 접근이 차단됩니다.

## 테스트 시나리오

### 1. 관리자 로그인

- 루트 페이지 접속 → 학생 배치 페이지로 자동 이동
- 네비게이션에서 "학생 배치", "마이페이지" 메뉴 확인
- 다른 사용자의 마이페이지 접근 가능

### 2. 일반 강사 로그인

- 루트 페이지 접속 → 자신의 마이페이지로 자동 이동
- 학생 배치 페이지 접근 시 자신의 마이페이지로 리다이렉트 + 토스트 메시지
- 다른 사용자의 마이페이지 접근 시 자신의 마이페이지로 리다이렉트 + 토스트 메시지
- 네비게이션에서 "마이페이지" 메뉴만 확인

### 3. 비로그인 사용자

- 모든 보호된 페이지 접근 시 로그인 페이지로 리다이렉트
- 토스트 메시지: "로그인이 필요한 페이지입니다"
