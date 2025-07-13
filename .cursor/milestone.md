# PMS 보충 시스템 개편 마일스톤

## 개편 개요

- **기존 시스템**: 선생님마다 학생을 할당하여 개별적으로 보충 진행
- **신규 시스템**: 평일(월~금) 각 요일마다 담당 선생님이 오후 6시~10시 보충 진행
  - **Prime Clinic (18:00-19:00)**: 담당 선생님이 수업 진행
  - **Sub Clinic (19:00-22:00)**: 자유 질문 시간 (조교들에게 질문 가능)

## 데이터 모델 변경사항 (2025.01.XX)

### 1. Time 모델 주석처리 ✅

- **사유**: 보충 시간이 18:00-22:00으로 고정되어 시간 관리가 불필요
- **변경사항**: 전체 클래스를 주석처리하여 기존 데이터 보존

### 2. User 모델 수정 ✅

- **주석처리된 필드**: `available_time` (ManyToManyField)
- **사유**: Time 모델이 더 이상 사용되지 않음
- **기존 필드 유지**: `user_name`, `user_subject`, `max_student_num` 등

### 3. Student 모델 대폭 수정 ✅

- **주석처리된 필드들**:
  - `expected_teacher`: 특정 선생님 지정이 불필요
  - `assigned_teacher`: 개별 배치 시스템 폐지
  - `clinic_attended_dates`: 출석 관리 방식 변경 예정
  - `available_time`: Time 모델 의존성 제거
- **신규 필드**:
  - `reserved_clinic`: Clinic 모델과 ManyToMany 관계로 학생의 클리닉 예약 관리

### 4. Clinic 모델 재설계 ✅

- **DAY_CHOICES 추가**: 평일(월~금) 요일 선택지
- **필드 변경**:
  - `clinic_students` → 삭제
  - `clinic_time` → `clinic_day` (요일 기반으로 변경)
  - `clinic_prime_students` 추가: Prime Clinic 등록 학생들
  - `clinic_sub_students` 추가: Sub Clinic 등록 학생들
- **관계 변경**: Student 모델의 `reserved_clinic`과 양방향 관계 설정

### 5. Comment 모델 주석처리 ✅

- **사유**: 보충 시스템 개편으로 코멘트 기능 불필요
- **변경사항**: 전체 클래스를 주석처리하여 기존 데이터 보존

## 프론트엔드 컴포넌트 변경사항 (2025.01.XX)

### 1. 학생 배치 페이지 수정 ✅

- **파일**: `frontend/src/app/student-placement/page.tsx`
- **변경사항**:
  - TeacherBox 컴포넌트 import 주석처리
  - Teacher 타입 임시 정의 (기존 코드 호환성 유지)
  - TeacherBox 렌더링 부분 주석처리
  - 임시 안내 메시지 추가: "보충 시스템 개편 진행중"
  - 모든 배치 관련 핸들러 함수들 주석처리 및 더미 함수로 대체
  - fetchData에서 assigned_teacher 관련 로직 주석처리
- **효과**: 기존 선생님별 학생 배치 UI가 숨겨지고, 시스템 개편 안내 표시, 모든 학생이 미배치 상태로 표시

## 예상 신청 양식 구조

```
타임스탬프 | 학생 이름 | 학생 핸드폰 번호 | 보충 희망 요일 [18-19 숙제 해설] | 보충 희망 요일 [19-22 자유 질문]
```

## 백엔드 API 수정사항 (2025.01.XX)

### 1. Serializers 수정 ✅

- **파일**: `backend/api/serializers.py`
- **변경사항**:
  - Time, Comment 모델 import 주석처리
  - TimeSerializer, CommentSerializer 주석처리
  - UserSerializer에서 available_time 관련 필드 주석처리
  - StudentSerializer에서 주석처리된 필드들 제거, reserved_clinic 필드 추가
  - ClinicSerializer에서 clinic_time → clinic_day 변경

### 2. Views 수정 ✅

- **파일**: `backend/api/views.py`
- **변경사항**:
  - Time, Comment 모델 import 주석처리
  - StudentViewSet에서 assigned_teacher 필터링 주석처리
  - upload_excel 메서드에서 시간대 관련 로직 주석처리
  - TimeViewSet, CommentViewSet 주석처리
  - UserMyPageView에서 assigned_teacher 관련 로직 주석처리
  - TeacherAvailableTimeUpdateView 주석처리

### 3. URLs 수정 ✅

- **파일**: `backend/api/urls.py`
- **변경사항**:
  - TimeViewSet, CommentViewSet 라우터 등록 주석처리
  - Comment 관련 URL 패턴 주석처리
  - TeacherAvailableTimeUpdateView URL 주석처리

### 4. 프론트엔드 API 수정 ✅

- **파일**: `frontend/src/lib/api.ts`
- **변경사항**:
  - Teacher 타입 import 주석처리 및 임시 타입 정의
  - assignStudent, unassignStudent 함수들 주석처리
  - 기존 코드 호환성을 위한 더미 함수들 추가

### 5. 미사용 파일 삭제 ✅

- **삭제된 파일들**:
  - `frontend/src/api/auth.ts`
  - `frontend/src/api/studentPlacement.ts`

## 다음 단계

1. [ ] 데이터베이스 마이그레이션 생성 및 적용
2. [x] 기존 컴포넌트 수정 (TeacherBox 제거 등)
3. [ ] 새로운 UI 컴포넌트 개발 (요일별 클리닉 선택)
4. [x] API 엔드포인트 수정
5. [ ] 프론트엔드 로직 업데이트

## 주의사항

- 기존 데이터 무결성 유지를 위해 필드 삭제 대신 주석처리 사용
- 모든 필드는 `blank=True` 설정으로 점진적 마이그레이션 지원
- 기존 StudentPlacement 모델은 유지하여 기존 데이터 보존
