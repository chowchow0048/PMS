// 사용자 타입
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
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