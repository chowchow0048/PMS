-- Railway 프로덕션 환경에서 중복 출석 데이터 정리 SQL
-- unique 제약 조건 생성 전에 실행해야 함

-- 1. 비활성화된 출석 데이터 삭제
DELETE FROM core_clinicattendance 
WHERE is_active = false;

-- 2. expected_clinic_date가 2025-01-01인 중복 데이터 정리
-- 각 (clinic_id, student_id) 조합에서 가장 최근 것만 유지
WITH duplicate_attendance AS (
    SELECT 
        id,
        clinic_id,
        student_id,
        expected_clinic_date,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY clinic_id, student_id, expected_clinic_date 
            ORDER BY created_at DESC
        ) as rn
    FROM core_clinicattendance
    WHERE expected_clinic_date = '2025-01-01'
)
DELETE FROM core_clinicattendance 
WHERE id IN (
    SELECT id FROM duplicate_attendance WHERE rn > 1
);

-- 3. 다른 날짜에서도 중복 확인 및 정리
WITH all_duplicates AS (
    SELECT 
        id,
        clinic_id,
        student_id,
        expected_clinic_date,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY clinic_id, student_id, expected_clinic_date 
            ORDER BY created_at DESC
        ) as rn
    FROM core_clinicattendance
)
DELETE FROM core_clinicattendance 
WHERE id IN (
    SELECT id FROM all_duplicates WHERE rn > 1
);

-- 4. 정리 결과 확인
SELECT 
    'cleanup_complete' as status,
    COUNT(*) as remaining_records,
    COUNT(DISTINCT concat(clinic_id, '-', student_id, '-', expected_clinic_date)) as unique_combinations
FROM core_clinicattendance;