from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"
    verbose_name = "핵심 모델"

    def ready(self):
        """앱이 준비되면 시그널을 등록합니다."""
        import core.signals  # 시그널 모듈 임포트하여 등록
