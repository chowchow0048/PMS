from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"
    verbose_name = "핵심 모델"

    def ready(self):
        """앱이 준비되면 시그널과 스케줄러를 등록합니다."""
        import core.signals  # 시그널 모듈 임포트하여 등록

        # APScheduler 자동 시작 (특정 명령어 실행 시에는 스케줄러 시작하지 않음)
        import sys
        import os

        # 스케줄러를 시작하지 않을 명령어들
        skip_commands = [
            "migrate",
            "makemigrations",
            "collectstatic",
            "shell",
            "dbshell",
            "test",
            "check",
            "scheduler_status",
            "reset_weekly_clinics",
        ]

        # Railway 환경에서만 자동 시작 (개발 환경에서는 수동 시작)
        is_railway = os.environ.get("RAILWAY_ENVIRONMENT_NAME") is not None
        should_start_scheduler = (
            is_railway
            and not any(cmd in sys.argv for cmd in skip_commands)
            and "runserver" not in sys.argv  # 개발 서버 실행 시에는 시작하지 않음
        )

        if should_start_scheduler:
            try:
                # 스케줄러 시작을 지연시켜 Django가 완전히 초기화된 후 실행
                import threading
                import time

                def delayed_start():
                    time.sleep(5)  # 5초 대기
                    try:
                        from .scheduler import start_scheduler

                        start_scheduler()
                    except Exception as e:
                        import logging

                        logger = logging.getLogger(__name__)
                        logger.error(f"지연된 스케줄러 시작 중 오류: {str(e)}")

                # 백그라운드 스레드에서 스케줄러 시작
                threading.Thread(target=delayed_start, daemon=True).start()

            except Exception as e:
                import logging

                logger = logging.getLogger(__name__)
                logger.error(f"스케줄러 시작 중 오류 발생: {str(e)}")
