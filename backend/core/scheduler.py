"""
Django APScheduler를 사용한 주간 클리닉 예약 초기화 스케줄러

매주 한국시간 월요일 00:00에 클리닉 예약을 자동으로 초기화합니다.
"""

import logging
from django.core.management import call_command
from django.utils import timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler.models import DjangoJobExecution
import atexit

# 로거 설정
logger = logging.getLogger(__name__)

# 글로벌 스케줄러 인스턴스
scheduler = None


def reset_weekly_clinics_job():
    """
    매주 실행되는 클리닉 예약 초기화 작업
    """
    try:
        logger.info("[Scheduler] 주간 클리닉 예약 초기화 작업 시작")

        # Django management command 실행
        call_command("reset_weekly_clinics", "--force")

        logger.info("[Scheduler] 주간 클리닉 예약 초기화 작업 완료")

    except Exception as e:
        logger.error(
            f"[Scheduler] 클리닉 예약 초기화 중 오류 발생: {str(e)}", exc_info=True
        )
        raise


def delete_old_job_executions(max_age=604_800):
    """
    오래된 작업 실행 기록을 삭제합니다 (기본: 7일)

    Args:
        max_age (int): 보관할 기간 (초 단위, 기본 7일)
    """
    try:
        DjangoJobExecution.objects.delete_old_job_executions(max_age)
        logger.info(f"[Scheduler] {max_age}초 이전의 작업 실행 기록을 정리했습니다")
    except Exception as e:
        logger.error(f"[Scheduler] 작업 실행 기록 정리 중 오류: {str(e)}")


def start_scheduler():
    """
    APScheduler 시작
    """
    global scheduler

    # 이미 실행 중인 스케줄러가 있으면 중복 실행 방지
    if scheduler is not None and scheduler.running:
        logger.info("[Scheduler] 스케줄러가 이미 실행 중입니다")
        return scheduler

    try:
        # 스케줄러 초기화
        scheduler = BackgroundScheduler(timezone="Asia/Seoul")

        # Django 데이터베이스를 job store로 사용
        scheduler.add_jobstore(DjangoJobStore(), "default")

        # 주간 클리닉 예약 초기화 작업 추가
        # 매주 월요일 00:00 (한국시간)에 실행
        scheduler.add_job(
            reset_weekly_clinics_job,
            trigger=CronTrigger(
                day_of_week=0,  # 월요일 (0=Monday, 1=Tuesday, ..., 6=Sunday)
                hour=0,  # 자정
                minute=0,  # 0분
                second=0,  # 0초
                timezone="Asia/Seoul",
            ),
            id="reset_weekly_clinics",  # 고유 ID
            max_instances=1,  # 동시에 하나의 인스턴스만 실행
            replace_existing=True,  # 기존 작업이 있으면 대체
            name="주간 클리닉 예약 초기화",
        )

        # 작업 실행 기록 정리 작업 추가
        # 매일 02:00에 오래된 기록 삭제
        scheduler.add_job(
            delete_old_job_executions,
            trigger=CronTrigger(
                hour=2, minute=0, second=0, timezone="Asia/Seoul"  # 새벽 2시
            ),
            id="delete_old_job_executions",
            max_instances=1,
            replace_existing=True,
            name="작업 실행 기록 정리",
        )

        # 스케줄러 시작
        scheduler.start()
        logger.info("[Scheduler] APScheduler가 성공적으로 시작되었습니다")
        logger.info("[Scheduler] 등록된 작업:")
        for job in scheduler.get_jobs():
            logger.info(f"  - {job.name} (ID: {job.id}): {job.trigger}")

        # 애플리케이션 종료 시 스케줄러도 함께 종료
        atexit.register(lambda: scheduler.shutdown() if scheduler else None)

        return scheduler

    except Exception as e:
        logger.error(f"[Scheduler] 스케줄러 시작 중 오류 발생: {str(e)}", exc_info=True)
        raise


def stop_scheduler():
    """
    APScheduler 정지
    """
    global scheduler

    if scheduler is not None and scheduler.running:
        scheduler.shutdown()
        logger.info("[Scheduler] APScheduler가 정지되었습니다")
    else:
        logger.info("[Scheduler] 정지할 스케줄러가 없습니다")


def get_scheduler_status():
    """
    스케줄러 상태 확인

    Returns:
        dict: 스케줄러 상태 정보
    """
    global scheduler

    if scheduler is None:
        return {
            "running": False,
            "jobs": [],
            "message": "스케줄러가 초기화되지 않았습니다",
        }

    try:
        jobs_info = []
        for job in scheduler.get_jobs():
            next_run = job.next_run_time
            jobs_info.append(
                {
                    "id": job.id,
                    "name": job.name,
                    "trigger": str(job.trigger),
                    "next_run": next_run.isoformat() if next_run else None,
                    "next_run_kst": (
                        next_run.astimezone(timezone.get_current_timezone()).strftime(
                            "%Y-%m-%d %H:%M:%S KST"
                        )
                        if next_run
                        else None
                    ),
                }
            )

        return {
            "running": scheduler.running,
            "jobs": jobs_info,
            "message": f"스케줄러 실행 중 ({len(jobs_info)}개 작업 등록됨)",
        }

    except Exception as e:
        return {
            "running": False,
            "jobs": [],
            "message": f"스케줄러 상태 확인 중 오류: {str(e)}",
        }
