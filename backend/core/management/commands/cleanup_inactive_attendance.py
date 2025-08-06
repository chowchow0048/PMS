"""
비활성화된 ClinicAttendance 데이터를 정리하는 관리 명령어
unique 제약 조건 충돌 방지를 위해 is_active=False인 출석 데이터를 삭제합니다.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import ClinicAttendance


class Command(BaseCommand):
    help = (
        "비활성화된 ClinicAttendance 데이터를 정리합니다 (unique 제약 조건 충돌 방지)"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="실제 삭제하지 않고 삭제될 데이터만 확인",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="확인 없이 강제 삭제",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        force = options["force"]

        self.stdout.write(
            self.style.SUCCESS("=== 비활성화된 출석 데이터 정리 시작 ===")
        )

        # 비활성화된 출석 데이터 조회
        inactive_attendances = ClinicAttendance.objects.filter(is_active=False)
        total_count = inactive_attendances.count()

        if total_count == 0:
            self.stdout.write(
                self.style.SUCCESS("✅ 정리할 비활성화된 출석 데이터가 없습니다.")
            )
            return

        self.stdout.write(
            f"📊 총 {total_count}개의 비활성화된 출석 데이터를 발견했습니다."
        )

        # 상세 정보 표시
        if total_count <= 20:  # 20개 이하면 상세 정보 표시
            self.stdout.write("\n📋 삭제될 데이터 목록:")
            for attendance in inactive_attendances:
                self.stdout.write(
                    f"  - ID: {attendance.id}, "
                    f"학생: {attendance.student.name}, "
                    f"클리닉: {attendance.clinic}, "
                    f"예상날짜: {attendance.expected_clinic_date}, "
                    f'생성: {attendance.created_at.strftime("%Y-%m-%d %H:%M")}'
                )

        if dry_run:
            self.stdout.write(
                self.style.WARNING("🔍 --dry-run 모드: 실제 삭제하지 않습니다.")
            )
            return

        # 사용자 확인
        if not force:
            self.stdout.write(
                self.style.WARNING(
                    f"\n⚠️  {total_count}개의 비활성화된 출석 데이터를 삭제합니다."
                )
            )
            confirm = input("계속하시겠습니까? [y/N]: ")
            if confirm.lower() not in ["y", "yes"]:
                self.stdout.write(self.style.ERROR("❌ 작업이 취소되었습니다."))
                return

        # 트랜잭션으로 안전하게 삭제
        try:
            with transaction.atomic():
                deleted_count, _ = inactive_attendances.delete()

                self.stdout.write(
                    self.style.SUCCESS(
                        f"✅ {deleted_count}개의 비활성화된 출석 데이터를 성공적으로 삭제했습니다."
                    )
                )

                # 남은 활성 출석 데이터 확인
                active_count = ClinicAttendance.objects.filter(is_active=True).count()
                self.stdout.write(f"📊 남은 활성 출석 데이터: {active_count}개")

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ 삭제 중 오류가 발생했습니다: {str(e)}")
            )
            raise

        self.stdout.write(
            self.style.SUCCESS("=== 비활성화된 출석 데이터 정리 완료 ===")
        )
