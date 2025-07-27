from django.core.management.base import BaseCommand
from core.scheduler import get_scheduler_status, start_scheduler, stop_scheduler
import json


class Command(BaseCommand):
    """
    APScheduler 상태 확인 및 관리 명령어

    Usage:
        python manage.py scheduler_status         # 상태 확인
        python manage.py scheduler_status start   # 스케줄러 시작
        python manage.py scheduler_status stop    # 스케줄러 정지
    """

    help = "APScheduler 상태 확인 및 관리"

    def add_arguments(self, parser):
        parser.add_argument(
            "action",
            nargs="?",
            choices=["status", "start", "stop"],
            default="status",
            help="수행할 작업 (기본값: status)",
        )

        parser.add_argument("--json", action="store_true", help="JSON 형식으로 출력")

    def handle(self, *args, **options):
        action = options["action"]
        json_output = options["json"]

        try:
            if action == "start":
                self.start_scheduler()
            elif action == "stop":
                self.stop_scheduler()
            else:  # status (기본값)
                self.show_status(json_output)

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"스케줄러 작업 중 오류 발생: {str(e)}"))

    def show_status(self, json_output=False):
        """
        스케줄러 상태 표시
        """
        status = get_scheduler_status()

        if json_output:
            # JSON 형식으로 출력
            self.stdout.write(json.dumps(status, indent=2, ensure_ascii=False))
        else:
            # 사람이 읽기 쉬운 형식으로 출력
            self.stdout.write(f"\n🔄 APScheduler 상태: {status['message']}")
            self.stdout.write(
                f"📊 실행 상태: {'✅ 실행 중' if status['running'] else '❌ 정지됨'}"
            )

            if status["jobs"]:
                self.stdout.write(f"\n📋 등록된 작업 ({len(status['jobs'])}개):")
                for job in status["jobs"]:
                    self.stdout.write(f"  • {job['name']} (ID: {job['id']})")
                    self.stdout.write(f"    - 트리거: {job['trigger']}")
                    if job["next_run_kst"]:
                        self.stdout.write(f"    - 다음 실행: {job['next_run_kst']}")
                    self.stdout.write("")
            else:
                self.stdout.write("\n📋 등록된 작업이 없습니다.")

    def start_scheduler(self):
        """
        스케줄러 시작
        """
        try:
            start_scheduler()
            self.stdout.write(
                self.style.SUCCESS("✅ 스케줄러가 성공적으로 시작되었습니다.")
            )
            # 시작 후 상태 표시
            self.show_status()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ 스케줄러 시작 실패: {str(e)}"))

    def stop_scheduler(self):
        """
        스케줄러 정지
        """
        try:
            stop_scheduler()
            self.stdout.write(
                self.style.SUCCESS("✅ 스케줄러가 성공적으로 정지되었습니다.")
            )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ 스케줄러 정지 실패: {str(e)}"))
