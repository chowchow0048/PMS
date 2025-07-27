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

        # Railway 환경 확인 및 스케줄러 시작 조건 설정
        is_railway = os.environ.get("RAILWAY_ENVIRONMENT_NAME") is not None
        is_gunicorn = "gunicorn" in sys.argv[0] if sys.argv else False

        # 로깅 설정
        import logging

        logger = logging.getLogger(__name__)

        # 로그 출력 (항상 출력되도록 info 레벨 사용)
        print(f"[CoreConfig] Django 앱 초기화 중...")
        print(f"[CoreConfig] Railway 환경: {is_railway}")
        print(f"[CoreConfig] Gunicorn 실행: {is_gunicorn}")
        print(f"[CoreConfig] sys.argv: {sys.argv}")

        should_start_scheduler = (
            is_railway
            and is_gunicorn
            and not any(cmd in sys.argv for cmd in skip_commands)
        )

        print(f"[CoreConfig] 스케줄러 시작 여부: {should_start_scheduler}")

        if should_start_scheduler:
            try:
                print("[CoreConfig] 스케줄러 자동 시작 준비 중...")

                # 스케줄러 시작을 지연시켜 Django가 완전히 초기화된 후 실행
                import threading
                import time

                def delayed_start():
                    print("[CoreConfig] 스케줄러 지연 시작 시작 (5초 대기)...")
                    time.sleep(5)  # 5초 대기
                    try:
                        from .scheduler import start_scheduler

                        print("[CoreConfig] 스케줄러 시작 함수 호출...")
                        scheduler_instance = start_scheduler()
                        if scheduler_instance:
                            print(
                                "[CoreConfig] ✅ 스케줄러가 성공적으로 시작되었습니다!"
                            )
                        else:
                            print("[CoreConfig] ⚠️ 스케줄러가 None을 반환했습니다.")
                    except Exception as e:
                        print(f"[CoreConfig] ❌ 지연된 스케줄러 시작 중 오류: {str(e)}")
                        import traceback

                        traceback.print_exc()

                # 백그라운드 스레드에서 스케줄러 시작
                thread = threading.Thread(target=delayed_start, daemon=True)
                thread.start()
                print("[CoreConfig] 스케줄러 시작 스레드 생성 완료")

            except Exception as e:
                print(f"[CoreConfig] ❌ 스케줄러 시작 준비 중 오류 발생: {str(e)}")
                import traceback

                traceback.print_exc()
        else:
            print("[CoreConfig] 스케줄러 자동 시작 조건에 맞지 않음")
