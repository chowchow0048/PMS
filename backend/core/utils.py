"""
동시접속 보호 및 성능 최적화 유틸리티

선착순 예약 시스템에서 다수의 동시 접속자가 같은 클리닉을 예약하려 할 때
발생할 수 있는 경합 조건(race condition)을 방지하기 위한 유틸리티 함수들을 제공합니다.

주요 기능:
1. 클리닉 예약 락 관리
2. 사용자별 요청 제한 (Rate limiting)
3. 데이터베이스 연결 최적화
4. 캐싱 메커니즘
"""

import time
import logging
from functools import wraps
from django.core.cache import cache
from django.db import transaction
from django.http import JsonResponse
from django.conf import settings
from datetime import datetime, timedelta
from django.utils import timezone

logger = logging.getLogger(__name__)


class ReservationLockManager:
    """클리닉 예약 락 관리자"""

    LOCK_TIMEOUT = 30  # 락 타임아웃 (초)
    LOCK_PREFIX = "clinic_reservation_lock"

    @classmethod
    def get_lock_key(cls, clinic_id):
        """클리닉 ID에 대한 락 키 생성"""
        return f"{cls.LOCK_PREFIX}:{clinic_id}"

    @classmethod
    def acquire_lock(cls, clinic_id, timeout=None):
        """클리닉 예약 락 획득"""
        if timeout is None:
            timeout = cls.LOCK_TIMEOUT

        lock_key = cls.get_lock_key(clinic_id)
        lock_value = f"{timezone.now().timestamp()}:{clinic_id}"

        # 락 획득 시도
        acquired = cache.add(lock_key, lock_value, timeout)

        if acquired:
            logger.info(f"[utils.py] 클리닉 {clinic_id} 락 획득 성공")
        else:
            logger.warning(f"[utils.py] 클리닉 {clinic_id} 락 획득 실패 - 이미 처리 중")

        return acquired

    @classmethod
    def release_lock(cls, clinic_id):
        """클리닉 예약 락 해제"""
        lock_key = cls.get_lock_key(clinic_id)
        released = cache.delete(lock_key)

        if released:
            logger.info(f"[utils.py] 클리닉 {clinic_id} 락 해제 성공")
        else:
            logger.warning(f"[utils.py] 클리닉 {clinic_id} 락 해제 실패")

        return released

    @classmethod
    def is_locked(cls, clinic_id):
        """클리닉이 락되어 있는지 확인"""
        lock_key = cls.get_lock_key(clinic_id)
        return cache.get(lock_key) is not None


class RateLimiter:
    """사용자별 요청 제한"""

    RATE_LIMIT_PREFIX = "rate_limit"
    DEFAULT_LIMIT = 10  # 기본 제한: 10회/분
    DEFAULT_WINDOW = 60  # 기본 윈도우: 60초

    @classmethod
    def get_rate_limit_key(cls, user_id, action):
        """Rate limit 키 생성"""
        return f"{cls.RATE_LIMIT_PREFIX}:{action}:{user_id}"

    @classmethod
    def is_rate_limited(cls, user_id, action, limit=None, window=None):
        """사용자의 요청이 제한되었는지 확인"""
        if limit is None:
            limit = cls.DEFAULT_LIMIT
        if window is None:
            window = cls.DEFAULT_WINDOW

        key = cls.get_rate_limit_key(user_id, action)
        current_count = cache.get(key, 0)

        if current_count >= limit:
            logger.warning(
                f"[utils.py] 사용자 {user_id}의 {action} 요청이 제한됨: {current_count}/{limit}"
            )
            return True

        # 요청 횟수 증가
        cache.set(key, current_count + 1, window)
        logger.debug(
            f"[utils.py] 사용자 {user_id}의 {action} 요청 카운트: {current_count + 1}/{limit}"
        )

        return False

    @classmethod
    def get_remaining_requests(cls, user_id, action, limit=None):
        """남은 요청 가능 횟수 반환"""
        if limit is None:
            limit = cls.DEFAULT_LIMIT

        key = cls.get_rate_limit_key(user_id, action)
        current_count = cache.get(key, 0)

        return max(0, limit - current_count)


def with_reservation_lock(timeout=30):
    """
    클리닉 예약 락을 사용하는 데코레이터

    사용 예:
    @with_reservation_lock(timeout=30)
    def reserve_clinic_view(request, clinic_id):
        # 클리닉 예약 로직
        pass
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # request에서 clinic_id 추출 시도
            clinic_id = None

            # args에서 찾기
            for arg in args[1:]:  # 첫 번째는 보통 request
                if hasattr(arg, "data") and "clinic_id" in arg.data:
                    clinic_id = arg.data["clinic_id"]
                    break
                elif isinstance(arg, dict) and "clinic_id" in arg:
                    clinic_id = arg["clinic_id"]
                    break

            # kwargs에서 찾기
            if clinic_id is None:
                clinic_id = kwargs.get("clinic_id")

            if clinic_id is None:
                logger.error(
                    "[utils.py] with_reservation_lock: clinic_id를 찾을 수 없음"
                )
                return func(*args, **kwargs)  # 락 없이 실행

            # 락 획득 시도
            if not ReservationLockManager.acquire_lock(clinic_id, timeout):
                return JsonResponse(
                    {
                        "error": "concurrent_access",
                        "message": "현재 다른 사용자가 해당 클리닉을 예약 중입니다. 잠시 후 다시 시도해주세요.",
                    },
                    status=409,
                )

            try:
                # 실제 함수 실행
                result = func(*args, **kwargs)
                return result
            finally:
                # 락 해제
                ReservationLockManager.release_lock(clinic_id)

        return wrapper

    return decorator


def with_rate_limit(action, limit=10, window=60):
    """
    요청 제한을 적용하는 데코레이터

    사용 예:
    @with_rate_limit(action='clinic_reservation', limit=5, window=60)
    def reserve_clinic_view(request):
        # 클리닉 예약 로직
        pass
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # request에서 사용자 ID 추출
            request = args[0] if args else None
            if (
                not request
                or not hasattr(request, "user")
                or not request.user.is_authenticated
            ):
                return func(*args, **kwargs)  # 인증되지 않은 경우 제한 없이 실행

            user_id = request.user.id

            # Rate limit 확인
            if RateLimiter.is_rate_limited(user_id, action, limit, window):
                remaining = RateLimiter.get_remaining_requests(user_id, action, limit)
                return JsonResponse(
                    {
                        "error": "rate_limited",
                        "message": f"요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요. (남은 요청: {remaining}회)",
                        "remaining_requests": remaining,
                        "window_seconds": window,
                    },
                    status=429,
                )

            return func(*args, **kwargs)

        return wrapper

    return decorator


class ClinicReservationOptimizer:
    """클리닉 예약 최적화 도구"""

    CACHE_TIMEOUT = 300  # 5분
    SCHEDULE_CACHE_KEY = "clinic_weekly_schedule"

    @classmethod
    def get_cached_schedule(cls):
        """캐시된 주간 스케줄 조회"""
        return cache.get(cls.SCHEDULE_CACHE_KEY)

    @classmethod
    def set_cached_schedule(cls, schedule_data, timeout=None):
        """주간 스케줄 캐시 저장"""
        if timeout is None:
            timeout = cls.CACHE_TIMEOUT
        return cache.set(cls.SCHEDULE_CACHE_KEY, schedule_data, timeout)

    @classmethod
    def invalidate_schedule_cache(cls):
        """주간 스케줄 캐시 무효화"""
        return cache.delete(cls.SCHEDULE_CACHE_KEY)

    @classmethod
    def get_clinic_status_cache_key(cls, clinic_id):
        """클리닉 상태 캐시 키 생성"""
        return f"clinic_status:{clinic_id}"

    @classmethod
    def get_cached_clinic_status(cls, clinic_id):
        """캐시된 클리닉 상태 조회"""
        key = cls.get_clinic_status_cache_key(clinic_id)
        return cache.get(key)

    @classmethod
    def set_cached_clinic_status(cls, clinic_id, status_data, timeout=60):
        """클리닉 상태 캐시 저장 (1분 캐시)"""
        key = cls.get_clinic_status_cache_key(clinic_id)
        return cache.set(key, status_data, timeout)

    @classmethod
    def invalidate_clinic_cache(cls, clinic_id):
        """특정 클리닉 캐시 무효화"""
        key = cls.get_clinic_status_cache_key(clinic_id)
        cache.delete(key)
        # 전체 스케줄 캐시도 무효화
        cls.invalidate_schedule_cache()


def log_performance(func_name):
    """성능 측정 데코레이터"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = func(*args, **kwargs)
                execution_time = time.time() - start_time

                logger.info(
                    f"[PERFORMANCE] {func_name} 실행 시간: {execution_time:.3f}초"
                )

                # 성능 임계값 체크 (2초 이상이면 경고)
                if execution_time > 2.0:
                    logger.warning(
                        f"[PERFORMANCE] {func_name} 실행 시간이 임계값을 초과했습니다: {execution_time:.3f}초"
                    )

                return result
            except Exception as e:
                execution_time = time.time() - start_time
                logger.error(
                    f"[PERFORMANCE] {func_name} 실행 중 오류 발생 (실행 시간: {execution_time:.3f}초): {str(e)}"
                )
                raise

        return wrapper

    return decorator


# 데이터베이스 최적화 관련 유틸리티
class DatabaseOptimizer:
    """데이터베이스 최적화 유틸리티"""

    @staticmethod
    def optimize_clinic_query():
        """클리닉 쿼리 최적화"""
        from .models import Clinic

        return Clinic.objects.select_related(
            "clinic_teacher", "clinic_subject", "weekly_period"
        ).prefetch_related("clinic_students")

    @staticmethod
    def get_clinic_with_lock(clinic_id):
        """락과 함께 클리닉 조회 (PostgreSQL OUTER JOIN 호환성 수정)"""
        from .models import Clinic

        # PostgreSQL에서 FOR UPDATE는 OUTER JOIN의 nullable side에 적용할 수 없음
        # 따라서 메인 테이블만 락을 걸고, 관련 객체는 별도로 조회
        clinic = Clinic.objects.select_for_update().get(id=clinic_id)

        # 필요한 관련 객체들을 별도로 조회하여 캐시에 저장 (N+1 문제 방지)
        if clinic.clinic_teacher_id:
            _ = clinic.clinic_teacher  # lazy loading으로 조회
        if clinic.clinic_subject_id:
            _ = clinic.clinic_subject  # lazy loading으로 조회

        return clinic
