from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"
    verbose_name = "핵심 모델"

    def ready(self):
        """앱이 준비되면 시그널과 스케줄러를 등록합니다."""
        import core.signals  # 시그널 모듈 임포트하여 등록

        # APScheduler 자동 시작 (migration이나 collectstatic 명령어 실행 시에는 스케줄러 시작하지 않음)
        import sys

        if (
            "migrate" not in sys.argv
            and "collectstatic" not in sys.argv
            and "makemigrations" not in sys.argv
        ):
            try:
                from .scheduler import start_scheduler

                start_scheduler()
            except Exception as e:
                import logging

                logger = logging.getLogger(__name__)
                logger.error(f"스케줄러 시작 중 오류 발생: {str(e)}")
