from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import Clinic
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    클리닉 스케줄 관리 명령어
    - activate: 모든 클리닉 활성화 (화요일 00:00 실행)
    - deactivate: 모든 클리닉 비활성화 (월요일 00:00 실행)
    - reset: 모든 클리닉 학생 예약 초기화 (월요일 00:00 실행)
    """

    help = "클리닉 스케줄 관리 (활성화/비활성화/초기화)"

    def add_arguments(self, parser):
        parser.add_argument(
            "action",
            choices=["activate", "deactivate", "reset"],
            help="수행할 작업: activate(활성화), deactivate(비활성화), reset(초기화)",
        )
        parser.add_argument("--force", action="store_true", help="확인 없이 강제 실행")

    def handle(self, *args, **options):
        action = options["action"]
        force = options["force"]

        try:
            if action == "activate":
                self.activate_clinics(force)
            elif action == "deactivate":
                self.deactivate_clinics(force)
            elif action == "reset":
                self.reset_clinic_students(force)

        except Exception as e:
            logger.error(f"클리닉 스케줄 관리 오류: {str(e)}")
            self.stdout.write(self.style.ERROR(f"오류 발생: {str(e)}"))

    def activate_clinics(self, force=False):
        """모든 클리닉 활성화"""
        clinics = Clinic.objects.all()
        inactive_count = clinics.filter(is_active=False).count()

        if not force and inactive_count > 0:
            confirm = input(
                f"{inactive_count}개의 비활성화된 클리닉을 활성화하시겠습니까? (y/N): "
            )
            if confirm.lower() != "y":
                self.stdout.write("작업이 취소되었습니다.")
                return

        # 모든 클리닉 활성화
        updated_count = clinics.update(is_active=True)

        logger.info(f"클리닉 활성화 완료: {updated_count}개")
        self.stdout.write(
            self.style.SUCCESS(f"✅ {updated_count}개의 클리닉이 활성화되었습니다.")
        )

    def deactivate_clinics(self, force=False):
        """모든 클리닉 비활성화"""
        clinics = Clinic.objects.all()
        active_count = clinics.filter(is_active=True).count()

        if not force and active_count > 0:
            confirm = input(
                f"{active_count}개의 활성화된 클리닉을 비활성화하시겠습니까? (y/N): "
            )
            if confirm.lower() != "y":
                self.stdout.write("작업이 취소되었습니다.")
                return

        # 모든 클리닉 비활성화
        updated_count = clinics.update(is_active=False)

        logger.info(f"클리닉 비활성화 완료: {updated_count}개")
        self.stdout.write(
            self.style.SUCCESS(f"🔒 {updated_count}개의 클리닉이 비활성화되었습니다.")
        )

    def reset_clinic_students(self, force=False):
        """모든 클리닉의 학생 예약 초기화"""
        clinics = Clinic.objects.all()

        # 예약된 학생 수 계산
        total_reservations = sum(clinic.clinic_students.count() for clinic in clinics)

        if not force and total_reservations > 0:
            confirm = input(
                f"총 {total_reservations}명의 학생 예약을 초기화하시겠습니까? (y/N): "
            )
            if confirm.lower() != "y":
                self.stdout.write("작업이 취소되었습니다.")
                return

        # 모든 클리닉의 학생 예약 초기화
        reset_count = 0
        for clinic in clinics:
            student_count = clinic.clinic_students.count()
            clinic.clinic_students.clear()
            reset_count += student_count

        logger.info(f"클리닉 학생 예약 초기화 완료: {reset_count}명")
        self.stdout.write(
            self.style.SUCCESS(f"🧹 총 {reset_count}명의 학생 예약이 초기화되었습니다.")
        )
