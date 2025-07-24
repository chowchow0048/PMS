// 사용자 타입 (Backend User 모델 기반으로 확장)
export interface User {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  name: string; // 사용자 이름
  user_name?: string; // 백엔드 호환성을 위한 필드 (일부 API에서 사용)
  phone_num?: string; // 전화번호
  subject?: number; // 담당 과목 ID 또는 수강 과목 ID
  is_teacher: boolean; // 강사 여부
  is_student: boolean; // 학생 여부
  is_staff: boolean; // 관리자 여부
  is_superuser: boolean; // 슈퍼유저 여부
  is_active: boolean; // 활성 상태
  
  // 학생 전용 필드들
  student_phone_num?: string; // 학생 전화번호
  student_parent_phone_num?: string; // 학부모 전화번호
  school?: string; // 학교
  grade?: string; // 학년
  
  // 추가 정보
  subject_name?: string; // 과목명 (조인된 정보)
}

// Student 타입을 User 기반으로 정의 (is_student=true인 User)
export interface Student extends User {
  is_student: true;
  student_name: string; // name과 동일하지만 기존 코드 호환성을 위해
  student_phone_num: string;
  student_parent_phone_num: string;
  school: string;
  grade: string;
}

// 프로젝트 멤버십 타입
export interface ProjectMembership {
  id: number;
  user: User;
  role: 'owner' | 'manager' | 'member';
  joined_at: string;
}

// 프로젝트 타입
export interface Project {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  owner: User;
  members_count: number;
}

// 프로젝트 상세 타입
export interface ProjectDetail extends Project {
  memberships: ProjectMembership[];
}

// 작업 상태 타입
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

// 작업 우선순위 타입
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// 작업 타입
export interface Task {
  id: number;
  title: string;
  description: string;
  project: number;
  project_name: string;
  assignee: User | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: User;
}

// 프로젝트 생성 요청 타입
export interface ProjectCreateRequest {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
}

// 작업 생성 요청 타입
export interface TaskCreateRequest {
  title: string;
  description: string;
  project: number;
  assignee?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
}

// 로그인 요청 타입
export interface LoginRequest {
  username: string;
  password: string;
}

// 사용자 등록 요청 타입
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
}

// 클리닉 타입 정의 (보충 시스템 개편 반영)
export interface Clinic {
  id: number;
  clinic_teacher: number;
  clinic_day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  clinic_time: string; // 클리닉 시간 (예: "18:00", "19:00", "20:00", "21:00")
  clinic_room: string; // 강의실 (예: "1강의실", "2강의실")
  clinic_capacity: number; // 정원
  clinic_subject: number;
  clinic_students: User[]; // 예약한 학생들 (통합됨)
  teacher_name: string;
  subject_name: string;
  day_display: string;
}

// 요일 선택지 타입
export interface DayChoice {
  value: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  label: string;
}

// 요일 선택지 상수
export const DAY_CHOICES: DayChoice[] = [
  { value: 'mon', label: '월요일' },
  { value: 'tue', label: '화요일' },
  { value: 'wed', label: '수요일' },
  { value: 'thu', label: '목요일' },
  { value: 'fri', label: '금요일' },
  { value: 'sat', label: '토요일' },
  { value: 'sun', label: '일요일' },
];

// 보충 시스템 개편으로 주석처리 - 더 이상 섹션 구분이 없음
// export type ClinicSection = 'unassigned' | 'prime' | 'sub';

// 클리닉 모달 프롭스 타입
export interface ClinicModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinic: Clinic | null;
  onUpdate: (clinic: Clinic) => void;
} 