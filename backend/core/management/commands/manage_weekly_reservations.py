"""
주간 클리닉 예약 기간 자동 관리 명령어

매주 다음과 같은 작업을 수행합니다:
1. 새로운 주간 예약 기간 생성
2. 기존 기간의 상태 업데이트
3. 완료된 기간의 정리 작업

사용법:
python manage.py manage_weekly_reservations

옵션:
--create-next-week: 다음 주 예약 기간만 생성
--update-status: 기존 기간들의 상태만 업데이트
--cleanup: 완료된 기간들의 정리 작업만 수행
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import datetime, timedelta
from core.models import WeeklyReservationPeriod, Clinic
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "주간 클리닉 예약 기간을 자동으로 관리합니다"

    def add_arguments(self, parser):
        # 특정 작업만 수행하는 옵션들
        parser.add_argument(
            "--create-next-week",
            action="store_true",
            help="다음 주 예약 기간만 생성",
        )
        parser.add_argument(
            "--update-status",
            action="store_true",
            help="기존 기간들의 상태만 업데이트",
        )
        parser.add_argument(
            "--cleanup",
            action="store_true",
            help="완료된 기간들의 정리 작업만 수행",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="실제 변경 없이 시뮬레이션만 수행",
        )

    def handle(self, *args, **options):
        self.dry_run = options["dry_run"]

        self.stdout.write(self.style.SUCCESS("🔄 주간 클리닉 예약 기간 관리 시작"))

        if self.dry_run:
            self.stdout.write(
                self.style.WARNING("⚠️  DRY RUN 모드: 실제 변경은 수행되지 않습니다")
            )

        try:
            # 특정 작업 옵션이 지정된 경우
            if options["create_next_week"]:
                self.create_next_week_period()
            elif options["update_status"]:
                self.update_period_status()
            elif options["cleanup"]:
                self.cleanup_completed_periods()
            else:
                # 전체 관리 작업 수행
                self.full_management()

            self.stdout.write(self.style.SUCCESS("✅ 주간 클리닉 예약 기간 관리 완료"))

        except Exception as e:
            logger.error(f"주간 예약 기간 관리 중 오류 발생: {str(e)}", exc_info=True)
            raise CommandError(f"관리 작업 중 오류가 발생했습니다: {str(e)}")

    def full_management(self):
        """전체 관리 작업 수행"""
        self.stdout.write("📅 전체 주간 예약 기간 관리 작업 수행...")

        # 1. 기존 기간들의 상태 업데이트
        self.update_period_status()

        # 2. 다음 주 예약 기간 생성
        self.create_next_week_period()

        # 3. 완료된 기간들 정리
        self.cleanup_completed_periods()

    def create_next_week_period(self):
        """다음 주 예약 기간 생성"""
        self.stdout.write("🆕 다음 주 예약 기간 생성 중...")

        try:
            if not self.dry_run:
                period, created = WeeklyReservationPeriod.create_weekly_period()

                if created:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"✅ 새로운 주간 예약 기간 생성: {period.week_start_date} ~ {period.week_end_date}"
                        )
                    )

                    # 해당 기간의 클리닉 수 계산 및 업데이트
                    total_clinics = self.count_clinics_for_period(period)
                    period.total_clinics = total_clinics
                    period.save()

                    self.stdout.write(f"📊 해당 기간 클리닉 수: {total_clinics}개")
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f"⚠️  해당 주 예약 기간이 이미 존재합니다: {period.week_start_date} ~ {period.week_end_date}"
                        )
                    )
            else:
                # DRY RUN: 다음 주 월요일 계산만 수행
                today = timezone.now().date()
                days_since_monday = today.weekday()
                next_monday = today + timedelta(days=(7 - days_since_monday))
                sunday = next_monday + timedelta(days=6)

                self.stdout.write(f"🔍 [DRY RUN] 생성할 기간: {next_monday} ~ {sunday}")

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ 다음 주 예약 기간 생성 실패: {str(e)}")
            )

    def update_period_status(self):
        """기존 예약 기간들의 상태 업데이트"""
        self.stdout.write("🔄 기존 예약 기간 상태 업데이트 중...")

        now = timezone.now()
        updated_count = 0

        # 모든 예약 기간 조회
        periods = WeeklyReservationPeriod.objects.all()

        for period in periods:
            old_status = period.status
            new_status = self.calculate_period_status(period, now)

            if old_status != new_status:
                if not self.dry_run:
                    period.status = new_status
                    period.save()
                    updated_count += 1

                self.stdout.write(
                    f"📝 {period.week_start_date} ~ {period.week_end_date}: "
                    f"{old_status} → {new_status}"
                )
            else:
                self.stdout.write(
                    f"✓ {period.week_start_date} ~ {period.week_end_date}: "
                    f"{old_status} (변경 없음)"
                )

        self.stdout.write(
            self.style.SUCCESS(f"✅ {updated_count}개 기간의 상태가 업데이트되었습니다")
        )

    def calculate_period_status(self, period, now):
        """예약 기간의 현재 상태 계산"""
        if now < period.reservation_start:
            return "pending"  # 예약 기간 시작 전
        elif period.reservation_start <= now < period.reservation_end:
            return "open"  # 예약 가능한 기간
        elif period.reservation_end <= now < period.reservation_end + timedelta(days=7):
            return "closed"  # 예약 마감 (해당 주 진행 중)
        else:
            return "completed"  # 해당 주 완료

    def cleanup_completed_periods(self):
        """완료된 예약 기간들의 정리 작업"""
        self.stdout.write("🧹 완료된 예약 기간 정리 작업 중...")

        # 4주 이상 된 완료된 기간들 조회
        cutoff_date = timezone.now().date() - timedelta(weeks=4)
        old_periods = WeeklyReservationPeriod.objects.filter(
            status="completed", week_end_date__lt=cutoff_date
        )

        cleanup_count = 0
        for period in old_periods:
            if not self.dry_run:
                # 관련 클리닉들의 weekly_period 참조 제거
                period.clinics.all().update(weekly_period=None)

                # 통계 정보 업데이트
                period.total_reservations = 0
                period.save()

                cleanup_count += 1

            self.stdout.write(
                f"🗑️  정리됨: {period.week_start_date} ~ {period.week_end_date}"
            )

        if cleanup_count > 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f"✅ {cleanup_count}개의 오래된 기간이 정리되었습니다"
                )
            )
        else:
            self.stdout.write("ℹ️  정리할 오래된 기간이 없습니다")

    def count_clinics_for_period(self, period):
        """특정 기간에 해당하는 클리닉 수 계산"""
        # 평일(월-금) x 4시간 = 최대 20개의 시간대
        # 실제로는 각 시간대별로 여러 강의실/과목의 클리닉이 있을 수 있음
        return Clinic.objects.all().count()

    def get_period_statistics(self, period):
        """예약 기간의 통계 정보 계산"""
        total_reservations = 0

        for clinic in period.clinics.all():
            total_reservations += clinic.get_current_students_count()

        return {
            "total_clinics": period.clinics.count(),
            "total_reservations": total_reservations,
        }
