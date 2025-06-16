export interface Student {
  id: number;
  student_name: string;
  school: string;
  grade: string;
}

export interface Teacher {
  id: number;
  teacher_name: string;
}

export interface Subject {
  id: number;
  subject_name: string;
}

export interface StudentPlacement {
  id: number;
  student: Student;
  teacher: Teacher;
  subject: Subject;
} 