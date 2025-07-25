from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import Clinic
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    매주 월요일 00:00에 모든 클리닉의 학생 예약을 초기화하는 command

    Usage:
        python manage.py reset_weekly_clinics

    Cron job 설정 예시:
        0 0 * * 1 cd /path/to/project && python manage.py reset_weekly_clinics
        (매주 월요일 00:00에 실행)
    """

    help = "매주 월요일 자정에 모든 클리닉의 학생 예약을 초기화합니다"

    def add_arguments(self, parser):
        # 강제 실행 옵션 (요일 상관없이 실행)
        parser.add_argument(
            "--force",
            action="store_true",
            help="요일 상관없이 강제로 클리닉 예약을 초기화합니다",
        )

        # 건식 실행 옵션 (실제로 변경하지 않고 시뮬레이션만)
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="실제로 변경하지 않고 어떤 작업이 수행될지만 보여줍니다",
        )

    def handle(self, *args, **options):
        # 현재 시간 및 요일 확인
        now = timezone.now()
        weekday = now.weekday()  # 0=Monday, 1=Tuesday, ..., 6=Sunday

        self.stdout.write(f"현재 시간: {now}")
        self.stdout.write(f"현재 요일: {weekday} (0=Monday, 6=Sunday)")

        # 월요일(0)이 아니고 --force 옵션이 없으면 종료
        if weekday != 0 and not options["force"]:
            self.stdout.write(
                self.style.WARNING(
                    "월요일이 아닙니다. --force 옵션을 사용하여 강제 실행할 수 있습니다."
                )
            )
            return

        # 강제 실행인 경우 경고 메시지
        if options["force"]:
            self.stdout.write(self.style.WARNING("--force 옵션으로 강제 실행합니다."))

        # 건식 실행인 경우 안내 메시지
        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING("--dry-run 옵션으로 시뮬레이션만 실행합니다.")
            )

        try:
            # 모든 클리닉 조회
            clinics = Clinic.objects.all()
            total_clinics = clinics.count()
            total_reset_students = 0

            self.stdout.write(f"총 {total_clinics}개의 클리닉을 처리합니다...")

            # 각 클리닉의 예약 학생 수 계산 및 초기화
            for clinic in clinics:
                student_count = clinic.clinic_students.count()
                total_reset_students += student_count

                # 예약된 학생이 있는 경우만 로그 출력
                if student_count > 0:
                    self.stdout.write(
                        f"클리닉 ID {clinic.id} ({clinic.get_clinic_day_display()} {clinic.clinic_time} {clinic.clinic_room}): "
                        f"{student_count}명의 학생 예약 {'시뮬레이션' if options['dry_run'] else '초기화'}"
                    )

                    # 실제 초기화 (dry-run이 아닌 경우)
                    if not options["dry_run"]:
                        clinic.clinic_students.clear()

            # 결과 요약
            if options["dry_run"]:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"시뮬레이션 완료: {total_clinics}개 클리닉에서 총 {total_reset_students}명의 학생 예약이 초기화될 예정입니다."
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"클리닉 예약 초기화 완료: {total_clinics}개 클리닉에서 총 {total_reset_students}명의 학생 예약이 초기화되었습니다."
                    )
                )

                # 로그 기록
                logger.info(
                    f"[reset_weekly_clinics] 주간 클리닉 예약 초기화 완료: "
                    f"총 {total_clinics}개 클리닉, {total_reset_students}명 학생 예약 초기화"
                )

        except Exception as e:
            error_msg = str(e)
            self.stdout.write(
                self.style.ERROR(f"클리닉 예약 초기화 중 오류 발생: {error_msg}")
            )
            logger.error(f"[reset_weekly_clinics] 오류 발생: {error_msg}")
            raise e
