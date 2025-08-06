"""
프로덕션 환경에서 중복 ClinicAttendance 데이터를 정리하는 관리 명령어
Railway 배포 전에 실행하여 unique 제약 조건 충돌을 방지합니다.
"""

from django.core.management.base import BaseCommand
from django.db import transaction, connection
from core.models import ClinicAttendance


class Command(BaseCommand):
    help = "프로덕션 환경에서 중복 ClinicAttendance 데이터를 정리합니다"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="실제 삭제하지 않고 분석만 수행",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="확인 없이 강제 실행",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        force = options["force"]

        self.stdout.write(
            self.style.SUCCESS("=== 프로덕션 중복 출석 데이터 정리 시작 ===")
        )

        # 1. 현재 상태 분석
        self.analyze_current_state()

        if dry_run:
            self.stdout.write(
                self.style.WARNING("🔍 --dry-run 모드: 실제 변경하지 않습니다.")
            )
            return

        if not force:
            confirm = input("계속하시겠습니까? [y/N]: ")
            if confirm.lower() not in ["y", "yes"]:
                self.stdout.write(self.style.ERROR("❌ 작업이 취소되었습니다."))
                return

        # 2. 중복 데이터 정리 실행
        try:
            with transaction.atomic():
                self.cleanup_duplicates()
                self.stdout.write(
                    self.style.SUCCESS("✅ 중복 데이터 정리가 완료되었습니다.")
                )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ 정리 중 오류가 발생했습니다: {str(e)}")
            )
            raise

        # 3. 정리 후 상태 확인
        self.analyze_current_state()

        self.stdout.write(
            self.style.SUCCESS("=== 프로덕션 중복 출석 데이터 정리 완료 ===")
        )

    def analyze_current_state(self):
        """현재 데이터 상태를 분석합니다."""
        self.stdout.write("\n📊 현재 출석 데이터 분석:")

        total_count = ClinicAttendance.objects.count()
        active_count = ClinicAttendance.objects.filter(is_active=True).count()
        inactive_count = ClinicAttendance.objects.filter(is_active=False).count()

        self.stdout.write(f"  - 전체 출석 데이터: {total_count}개")
        self.stdout.write(f"  - 활성 데이터: {active_count}개")
        self.stdout.write(f"  - 비활성 데이터: {inactive_count}개")

        # 중복 데이터 확인
        with connection.cursor() as cursor:
            # expected_clinic_date가 2025-01-01인 중복 확인
            cursor.execute(
                """
                SELECT 
                    clinic_id, 
                    student_id, 
                    expected_clinic_date,
                    COUNT(*) as count
                FROM core_clinicattendance 
                WHERE expected_clinic_date = '2025-01-01'
                GROUP BY clinic_id, student_id, expected_clinic_date
                HAVING COUNT(*) > 1
                ORDER BY count DESC
                LIMIT 10
            """
            )
            default_date_duplicates = cursor.fetchall()

            # 전체 중복 확인
            cursor.execute(
                """
                SELECT 
                    clinic_id, 
                    student_id, 
                    expected_clinic_date,
                    COUNT(*) as count
                FROM core_clinicattendance 
                GROUP BY clinic_id, student_id, expected_clinic_date
                HAVING COUNT(*) > 1
                ORDER BY count DESC
                LIMIT 10
            """
            )
            all_duplicates = cursor.fetchall()

        if default_date_duplicates:
            self.stdout.write("\n⚠️ 기본값(2025-01-01) 중복 데이터:")
            for clinic_id, student_id, date, count in default_date_duplicates:
                self.stdout.write(
                    f"  - 클리닉 {clinic_id}, 학생 {student_id}, 날짜 {date}: {count}개"
                )

        if all_duplicates:
            self.stdout.write("\n⚠️ 전체 중복 데이터 (상위 10개):")
            for clinic_id, student_id, date, count in all_duplicates:
                self.stdout.write(
                    f"  - 클리닉 {clinic_id}, 학생 {student_id}, 날짜 {date}: {count}개"
                )

        if not default_date_duplicates and not all_duplicates:
            self.stdout.write("✅ 중복 데이터가 발견되지 않았습니다.")

    def cleanup_duplicates(self):
        """중복 데이터를 정리합니다."""
        total_deleted = 0

        # 1. 비활성화된 데이터 삭제
        inactive_count = ClinicAttendance.objects.filter(is_active=False).count()
        if inactive_count > 0:
            self.stdout.write(
                f"📋 비활성화된 데이터 {inactive_count}개를 삭제합니다..."
            )
            deleted_count, _ = ClinicAttendance.objects.filter(is_active=False).delete()
            total_deleted += deleted_count
            self.stdout.write(f"  ✅ {deleted_count}개 삭제 완료")

        # 2. 중복 데이터 정리 (SQL 사용)
        with connection.cursor() as cursor:
            # 2-1. 기본값 중복 정리
            cursor.execute(
                """
                WITH duplicate_attendance AS (
                    SELECT 
                        id,
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
                )
            """
            )
            default_duplicates_deleted = cursor.rowcount

            if default_duplicates_deleted > 0:
                self.stdout.write(
                    f"📋 기본값 중복 데이터 {default_duplicates_deleted}개를 삭제했습니다."
                )
                total_deleted += default_duplicates_deleted

            # 2-2. 전체 중복 정리
            cursor.execute(
                """
                WITH all_duplicates AS (
                    SELECT 
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY clinic_id, student_id, expected_clinic_date 
                            ORDER BY created_at DESC
                        ) as rn
                    FROM core_clinicattendance
                )
                DELETE FROM core_clinicattendance 
                WHERE id IN (
                    SELECT id FROM all_duplicates WHERE rn > 1
                )
            """
            )
            all_duplicates_deleted = cursor.rowcount

            if all_duplicates_deleted > 0:
                self.stdout.write(
                    f"📋 전체 중복 데이터 {all_duplicates_deleted}개를 삭제했습니다."
                )
                total_deleted += all_duplicates_deleted

        self.stdout.write(
            f"🎉 총 {total_deleted}개의 중복/비활성 데이터를 정리했습니다."
        )
