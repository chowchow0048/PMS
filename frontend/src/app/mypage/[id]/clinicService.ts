// API 기본 URL - 백엔드 서버로 직접 요청
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// 학생 타입
export interface Student {
  id: number;
  name: string;
  school?: string;
  grade?: string;
  status?: 'unassigned' | 'assigned' | 'clinic-assigned';
  student_name?: string; // 백엔드에서 오는 필드
  student_phone_num?: string;
  student_parent_phone_num?: string;
}

// 과목 타입
export interface Subject {
  id: number;
  subject: string;
  subject_kr: string;
}

// 시간 타입
export interface Time {
  id: number;
  time_day: string;
  time_slot: string;
  display_day?: string; // 프론트엔드 표시용
  display_time?: string; // 프론트엔드 표시용
}

// 클리닉 타입
export interface Clinic {
  id?: number;
  day: string;
  time: string;
  startTime?: string;
  students: Student[];
  clinic_teacher?: number;
  clinic_students?: number[];
  clinic_time?: number;
  clinic_subject?: number;
}

/**
 * 현재 로그인한 강사의 클리닉 목록을 가져옵니다.
 * @param userId 사용자 ID
 */
export const fetchUsersClinics = async (userId?: string): Promise<Clinic[]> => {
  try {
    // 헤더에 토큰 추가
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('인증 정보가 없습니다.');
    }

    const headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };

    // userId가 제공되지 않은 경우 오류 발생
    let teacherId = userId;
    if (!teacherId) {
      throw new Error('사용자 ID가 필요합니다.');
    }
    
    // 강사의 클리닉 목록 가져오기
    const clinicsResponse = await fetch(`${API_BASE_URL}/clinics?teacher_id=${teacherId}`, {
      method: 'GET',
      headers
    });

    if (!clinicsResponse.ok) {
      throw new Error('클리닉 정보를 가져오는데 실패했습니다.');
    }

    const clinicsData = await clinicsResponse.json();
    
    // API 응답이 페이지네이션된 경우 results 필드에서 데이터 추출
    const actualClinicsData = Array.isArray(clinicsData) ? clinicsData : 
                             (clinicsData.results ? clinicsData.results : []);
    
    // 시간 정보 가져오기
    const timesResponse = await fetch(`${API_BASE_URL}/times/`, {
      method: 'GET',
      headers
    });

    if (!timesResponse.ok) {
      throw new Error('시간 정보를 가져오는데 실패했습니다.');
    }

    const timesData = await timesResponse.json();
    
    // API 응답이 페이지네이션된 경우 results 필드에서 데이터 추출
    const actualTimesData = Array.isArray(timesData) ? timesData : 
                           (timesData.results ? timesData.results : []);
    
    // 백엔드 데이터를 프론트엔드 형식으로 변환
    const clinics: Clinic[] = [];
    
    for (const clinic of actualClinicsData) {
      // 모든 클리닉을 포함하도록 수정 (학생이 없어도 클리닉 객체는 생성)
      const studentIds = clinic.clinic_students || [];
      console.log(`클리닉 ID ${clinic.id}의 초기 학생 IDs:`, studentIds);
      
      // 클리닉 시간 정보 찾기
      const timeInfo = actualTimesData.find((time: any) => time.id === clinic.clinic_time);
      
      if (timeInfo) {
        // 요일 변환 (영문 => 한글)
        const dayMap: { [key: string]: string } = {
          'mon': '월',
          'tue': '화',
          'wed': '수',
          'thu': '목',
          'fri': '금',
          'sat': '토',
          'sun': '일'
        };
        
        // 시간 변환 (HH:MM:SS => HH:00)
        const timeStr = timeInfo.time_slot.substring(0, 5);
        const hour = timeStr.split(':')[0];
        const day = dayMap[timeInfo.time_day] || timeInfo.time_day;
        
        // 새로운 클리닉 객체 생성 (해당 시간에만)
        const newClinic: Clinic = {
          id: clinic.id,
          day,
          time: `${hour}:00`,
          startTime: `${hour}:00`,
          students: [], // 학생 정보는 별도로 가져와서 채울 예정
          clinic_teacher: clinic.clinic_teacher,
          clinic_time: clinic.clinic_time,
          clinic_subject: clinic.clinic_subject
        };
        
        clinics.push(newClinic);
      }
    }
    
    // 학생 정보 가져오기
    const studentsResponse = await fetch(`${API_BASE_URL}/students/`, {
      method: 'GET',
      headers
    });

    if (!studentsResponse.ok) {
      throw new Error('학생 정보를 가져오는데 실패했습니다.');
    }

    const studentsData = await studentsResponse.json();
    
    // API 응답이 페이지네이션된 경우 results 필드에서 데이터 추출
    const actualStudentsData = Array.isArray(studentsData) ? studentsData : 
                              (studentsData.results ? studentsData.results : []);
    
    // 각 클리닉에 학생 정보 추가
    console.log('=== 학생 정보 연결 시작 ===');
    console.log('actualClinicsData:', actualClinicsData);
    console.log('actualStudentsData:', actualStudentsData);
    
    for (const clinic of actualClinicsData) {
      const studentIds = clinic.clinic_students || [];
      console.log(`클리닉 ID ${clinic.id}의 학생 IDs:`, studentIds);
      
      // 학생 ID 매칭 디버깅 추가
      console.log('첫 5명 학생 데이터 샘플:', actualStudentsData.slice(0, 5).map((s: any) => ({ id: s.id, name: s.student_name })));
      console.log('매칭하려는 학생 IDs:', studentIds);
      console.log('매칭하려는 학생 IDs 타입:', studentIds.map((id: any) => typeof id));
      console.log('학생 데이터 ID 타입 샘플:', actualStudentsData.slice(0, 5).map((s: any) => ({ id: s.id, type: typeof s.id })));
      
      const students = actualStudentsData.filter((student: any) => studentIds.includes(student.id));
      console.log(`클리닉 ID ${clinic.id}에 매칭된 학생들:`, students);
      
      // 클리닉 시간 정보 찾기
      const timeInfo = actualTimesData.find((time: any) => time.id === clinic.clinic_time);
      console.log(`클리닉 ID ${clinic.id}의 시간 정보:`, timeInfo);
      
      if (timeInfo) {
        // 요일 변환
        const dayMap: { [key: string]: string } = {
          'mon': '월', 'tue': '화', 'wed': '수', 'thu': '목', 'fri': '금', 'sat': '토', 'sun': '일'
        };
        const day = dayMap[timeInfo.time_day] || timeInfo.time_day;
        
        // 시간 변환
        const timeStr = timeInfo.time_slot.substring(0, 5);
        const hour = timeStr.split(':')[0];
        
        console.log(`변환된 요일/시간: ${day} ${hour}:00`);
        
        // 해당 시간의 클리닉만 찾기
        const foundClinic = clinics.find(c => c.day === day && c.time === `${hour}:00`);
        console.log(`찾은 클리닉:`, foundClinic);
        
        if (foundClinic) {
          foundClinic.students = students.map((student: any) => ({
            id: student.id,
            name: student.student_name,
            school: student.school,
            grade: student.grade,
            status: 'clinic-assigned'
          }));
          console.log(`클리닉 ID ${clinic.id}에 학생 정보 연결 완료:`, foundClinic.students);
        } else {
          console.log(`클리닉을 찾을 수 없음: ${day} ${hour}:00`);
        }
      }
    }
    
    console.log('=== 최종 클리닉 배열 ===');
    console.log('clinics:', clinics);
    
    return clinics;
  } catch (error) {
    console.error('클리닉 정보를 가져오는 중 오류 발생:', error);
    throw error;
  }
};

/**
 * 미배정된 학생 목록을 가져옵니다.
 */
export const fetchUnassignedStudents = async (): Promise<Student[]> => {
  try {
    // 헤더에 토큰 추가
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('인증 정보가 없습니다.');
    }

    const headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };

    // 현재 로그인한 사용자 정보는 localStorage에서 가져오기
    const userDataStr = localStorage.getItem('user');
    if (!userDataStr) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    const userData = JSON.parse(userDataStr);
    
    // 해당 강사에게 배정된 학생 목록 가져오기
    const studentsResponse = await fetch(`${API_BASE_URL}/students?teacher_id=${userData.id}`, {
      method: 'GET',
      headers
    });

    if (!studentsResponse.ok) {
      throw new Error('학생 정보를 가져오는데 실패했습니다.');
    }

    const studentsData = await studentsResponse.json();
    
    // API 응답이 페이지네이션된 경우 results 필드에서 데이터 추출
    const actualStudentsData = Array.isArray(studentsData) ? studentsData : 
                              (studentsData.results ? studentsData.results : []);
    
    // 학생 상태 변환
    const students = actualStudentsData.map((student: any) => ({
      id: student.id,
      name: student.student_name,
      school: student.school,
      grade: student.grade,
      status: 'assigned' // 강사에게 배정됐지만 아직 클리닉은 없는 상태
    }));
    
    return students;
  } catch (error) {
    console.error('학생 정보를 가져오는 중 오류 발생:', error);
    throw error;
  }
};

/**
 * 클리닉 정보를 서버에 저장합니다.
 * @param clinics 저장할 클리닉 목록
 * @param userId 사용자 ID
 */
export const saveClinicData = async (clinics: Clinic[], userId?: string): Promise<void> => {
  try {
    // 헤더에 토큰 추가
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('인증 정보가 없습니다.');
    }

    const headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };

    // userId가 제공되지 않은 경우 localStorage에서 사용자 정보 가져오기
    let teacherId = userId;
    let userSubject: number | null = null;
    
    // 현재 로그인한 사용자 정보는 localStorage에서 가져오기
    const userDataStr = localStorage.getItem('user');
    if (!userDataStr) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    const userData = JSON.parse(userDataStr);
    
    // 제공된 userId가 없으면 현재 로그인한 사용자 ID 사용
    if (!teacherId) {
      teacherId = userData.id.toString();
    }
    
    // 사용자 과목 정보 가져오기
    userSubject = userData.user_subject;
    
    // 시간 정보 가져오기
    const timesResponse = await fetch(`${API_BASE_URL}/times/`, {
      method: 'GET',
      headers
    });

    if (!timesResponse.ok) {
      throw new Error('시간 정보를 가져오는데 실패했습니다.');
    }

    const timesData = await timesResponse.json();
    
    // API 응답이 페이지네이션된 경우 results 필드에서 데이터 추출
    const actualTimesData = Array.isArray(timesData) ? timesData : 
                           (timesData.results ? timesData.results : []);
    
    // 과목 정보 가져오기
    const subjectsResponse = await fetch(`${API_BASE_URL}/subjects/`, {
      method: 'GET',
      headers
    });

    if (!subjectsResponse.ok) {
      throw new Error('과목 정보를 가져오는데 실패했습니다.');
    }

    const subjectsData = await subjectsResponse.json();
    
    // 클리닉 데이터 백엔드 형식으로 변환
    const backendClinics = [];
    
    // 요일 매핑 (한글 => 영문)
    const dayMap: { [key: string]: string } = {
      '월': 'mon',
      '화': 'tue',
      '수': 'wed',
      '목': 'thu',
      '금': 'fri',
      '토': 'sat',
      '일': 'sun'
    };
    
    // 중복 방지를 위한 Set
    const processedClinics = new Set();
    
    for (const clinic of clinics) {
      // 시작 시간과 일치하는 클리닉만 처리 (2시간 블록의 첫 시간)
      if (clinic.time === clinic.startTime && clinic.students.length > 0) {
        // day와 time으로 time 객체 찾기
        const dayCode = dayMap[clinic.day];
        const hourStr = clinic.time.split(':')[0];
        
        const timeObj = actualTimesData.find((t: any) => 
          t.time_day === dayCode && t.time_slot.startsWith(`${hourStr}:`)
        );
        
        if (timeObj && userSubject) {
          // 중복 체크를 위한 키
          const clinicKey = `${dayCode}-${hourStr}-${teacherId}`;
          
          if (!processedClinics.has(clinicKey)) {
            processedClinics.add(clinicKey);
            
            // 백엔드 형식의 클리닉 객체 생성
            const backendClinic = {
              clinic_teacher: teacherId,
              clinic_students: clinic.students.map(s => s.id),
              clinic_time: timeObj.id,
              clinic_subject: userSubject
            };
            
            backendClinics.push(backendClinic);
          }
        }
      }
    }
    
    // 서버에 클리닉 데이터 저장
    // 1. 기존 클리닉 조회 후 삭제
    const existingClinicsResponse = await fetch(`${API_BASE_URL}/clinics/?teacher_id=${teacherId}`, {
      method: 'GET',
      headers
    });
    
    if (existingClinicsResponse.ok) {
      const existingClinicsData = await existingClinicsResponse.json();
      
      // API 응답이 페이지네이션된 경우 results 필드에서 데이터 추출
      const actualExistingClinics = Array.isArray(existingClinicsData) ? existingClinicsData : 
                                   (existingClinicsData.results ? existingClinicsData.results : []);
      
      // 각 클리닉을 개별적으로 삭제
      for (const clinic of actualExistingClinics) {
        const deleteResponse = await fetch(`${API_BASE_URL}/clinics/${clinic.id}/`, {
          method: 'DELETE',
          headers
        });
        
        if (!deleteResponse.ok) {
          console.warn(`클리닉 ID ${clinic.id} 삭제 실패`);
        }
      }
    }
    
    // 2. 새 클리닉 등록
    console.log('=== 클리닉 저장 시작 ===');
    console.log('저장할 클리닉 수:', backendClinics.length);
    console.log('클리닉 데이터:', backendClinics);
    
    for (const clinic of backendClinics) {
      console.log('저장 중인 클리닉:', clinic);
      const createResponse = await fetch(`${API_BASE_URL}/clinics/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(clinic)
      });
      
      console.log('클리닉 저장 응답 상태:', createResponse.status);
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('클리닉 저장 실패:', errorText);
        throw new Error(`클리닉 생성에 실패했습니다: ${errorText}`);
      } else {
        const savedClinic = await createResponse.json();
        console.log('클리닉 저장 성공:', savedClinic);
      }
    }
    
    // 학생 상태 업데이트 (clinic-assigned로 변경)
    const assignedStudents = new Set<number>();
    clinics.forEach(clinic => {
      clinic.students.forEach(student => {
        assignedStudents.add(student.id);
      });
    });
    
    // 각 학생의 상태 업데이트
    for (const studentId of Array.from(assignedStudents)) {
      const updateResponse = await fetch(`${API_BASE_URL}/students/${studentId}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'clinic-assigned' })
      });
      
      if (!updateResponse.ok) {
        console.error(`학생 ID ${studentId} 상태 업데이트 실패`);
      }
    }
  } catch (error) {
    console.error('클리닉 저장 중 오류 발생:', error);
    throw error;
  }
};

/**
 * 개별 클리닉을 즉시 생성합니다.
 * @param day 요일
 * @param time 시간
 * @param studentIds 학생 ID 배열
 * @param userId 강사 ID
 */
export const createClinicImmediately = async (
  day: string, 
  time: string, 
  studentIds: number[], 
  userId: string
): Promise<Clinic> => {
  try {
    // 헤더에 토큰 추가
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('인증 정보가 없습니다.');
    }

    const headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };

    // 사용자 정보 가져오기
    const userDataStr = localStorage.getItem('user');
    if (!userDataStr) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    const userData = JSON.parse(userDataStr);
    const userSubject = userData.user_subject;

    // 시간 정보 가져오기
    const timesResponse = await fetch(`${API_BASE_URL}/times/`, {
      method: 'GET',
      headers
    });

    if (!timesResponse.ok) {
      throw new Error('시간 정보를 가져오는데 실패했습니다.');
    }

    const timesData = await timesResponse.json();
    const actualTimesData = Array.isArray(timesData) ? timesData : 
                           (timesData.results ? timesData.results : []);

    // 요일 매핑 (한글 => 영문)
    const dayMap: { [key: string]: string } = {
      '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', 
      '금': 'fri', '토': 'sat', '일': 'sun'
    };

    // day와 time으로 time 객체 찾기
    const dayCode = dayMap[day];
    const hourStr = time.split(':')[0];
    
    const timeObj = actualTimesData.find((t: any) => 
      t.time_day === dayCode && t.time_slot.startsWith(`${hourStr}:`)
    );

    if (!timeObj || !userSubject) {
      throw new Error('시간 정보 또는 과목 정보를 찾을 수 없습니다.');
    }

    // 백엔드 형식의 클리닉 객체 생성
    const backendClinic = {
      clinic_teacher: parseInt(userId),
      clinic_students: studentIds,
      clinic_time: timeObj.id,
      clinic_subject: userSubject
    };

    // 서버에 클리닉 생성
    const createResponse = await fetch(`${API_BASE_URL}/clinics/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(backendClinic)
    });

    if (!createResponse.ok) {
      throw new Error('클리닉 생성에 실패했습니다.');
    }

    const createdClinic = await createResponse.json();

    // 학생 정보 가져오기
    const studentsResponse = await fetch(`${API_BASE_URL}/students/`, {
      method: 'GET',
      headers
    });

    if (!studentsResponse.ok) {
      throw new Error('학생 정보를 가져오는데 실패했습니다.');
    }

    const studentsData = await studentsResponse.json();
    const actualStudentsData = Array.isArray(studentsData) ? studentsData : 
                              (studentsData.results ? studentsData.results : []);

    // 클리닉에 배정된 학생들 정보 가져오기
    const students = actualStudentsData
      .filter((student: any) => studentIds.includes(student.id))
      .map((student: any) => ({
        id: student.id,
        name: student.student_name,
        school: student.school,
        grade: student.grade,
        status: 'clinic-assigned'
      }));

    // 프론트엔드 형식의 클리닉 객체 반환
    return {
      id: createdClinic.id,
      day,
      time,
      startTime: time,
      students,
      clinic_teacher: createdClinic.clinic_teacher,
      clinic_time: createdClinic.clinic_time,
      clinic_subject: createdClinic.clinic_subject
    };

  } catch (error) {
    console.error('클리닉 즉시 생성 중 오류 발생:', error);
    throw error;
  }
};

/**
 * 개별 클리닉을 즉시 수정합니다.
 * @param clinicId 클리닉 ID
 * @param studentIds 새로운 학생 ID 배열
 */
export const updateClinicImmediately = async (
  clinicId: number, 
  studentIds: number[]
): Promise<void> => {
  try {
    // 헤더에 토큰 추가
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('인증 정보가 없습니다.');
    }

    const headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };

    // 클리닉 수정
    const updateResponse = await fetch(`${API_BASE_URL}/clinics/${clinicId}/`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ clinic_students: studentIds })
    });

    if (!updateResponse.ok) {
      throw new Error('클리닉 수정에 실패했습니다.');
    }

  } catch (error) {
    console.error('클리닉 즉시 수정 중 오류 발생:', error);
    throw error;
  }
};

/**
 * 개별 클리닉을 즉시 삭제합니다.
 * @param clinicId 클리닉 ID
 */
export const deleteClinicImmediately = async (clinicId: number): Promise<void> => {
  try {
    // 헤더에 토큰 추가
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('인증 정보가 없습니다.');
    }

    const headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };

    // 클리닉 삭제
    const deleteResponse = await fetch(`${API_BASE_URL}/clinics/${clinicId}/`, {
      method: 'DELETE',
      headers
    });

    if (!deleteResponse.ok) {
      throw new Error('클리닉 삭제에 실패했습니다.');
    }

  } catch (error) {
    console.error('클리닉 즉시 삭제 중 오류 발생:', error);
    throw error;
  }
};

/**
 * 학생을 클리닉에 즉시 배정합니다.
 * @param studentId 학생 ID
 * @param day 요일
 * @param time 시간
 * @param userId 강사 ID
 */
export const assignStudentImmediately = async (
  studentId: number,
  day: string,
  time: string,
  userId: string
): Promise<Clinic> => {
  try {
    // 기존 클리닉 확인
    const existingClinics = await fetchUsersClinics(userId);
    const existingClinic = existingClinics.find(c => c.day === day && c.time === time);

    if (existingClinic && existingClinic.id) {
      // 기존 클리닉이 있으면 학생 추가
      const currentStudentIds = existingClinic.students.map(s => s.id);
      const newStudentIds = [...currentStudentIds, studentId];
      
      await updateClinicImmediately(existingClinic.id, newStudentIds);
      
      // 업데이트된 클리닉 정보 반환
      const updatedClinics = await fetchUsersClinics(userId);
      const updatedClinic = updatedClinics.find(c => c.day === day && c.time === time);
      
      if (!updatedClinic) {
        throw new Error('업데이트된 클리닉을 찾을 수 없습니다.');
      }
      
      return updatedClinic;
    } else {
      // 새 클리닉 생성
      return await createClinicImmediately(day, time, [studentId], userId);
    }

  } catch (error) {
    console.error('학생 즉시 배정 중 오류 발생:', error);
    throw error;
  }
};

/**
 * 학생을 클리닉에서 즉시 제거합니다.
 * @param studentId 학생 ID
 * @param day 요일
 * @param time 시간
 * @param userId 강사 ID
 */
export const unassignStudentImmediately = async (
  studentId: number,
  day: string,
  time: string,
  userId: string
): Promise<void> => {
  try {
    // 기존 클리닉 확인
    const existingClinics = await fetchUsersClinics(userId);
    const existingClinic = existingClinics.find(c => c.day === day && c.time === time);

    if (existingClinic && existingClinic.id) {
      const currentStudentIds = existingClinic.students.map(s => s.id);
      const newStudentIds = currentStudentIds.filter(id => id !== studentId);
      
      if (newStudentIds.length === 0) {
        // 학생이 없으면 클리닉 삭제
        await deleteClinicImmediately(existingClinic.id);
      } else {
        // 학생이 있으면 클리닉 수정
        await updateClinicImmediately(existingClinic.id, newStudentIds);
      }
    }

  } catch (error) {
    console.error('학생 즉시 제거 중 오류 발생:', error);
    throw error;
  }
}; 