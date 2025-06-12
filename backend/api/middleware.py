from django.http import HttpResponseRedirect
from django.urls import resolve, reverse
import re
import logging

logger = logging.getLogger("api.auth")


class UserAccessMiddleware:
    """사용자 권한에 따른 접근 제어 미들웨어"""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 요청 처리 전 로직
        if request.user.is_authenticated:
            url_name = resolve(request.path_info).url_name
            logger.info(
                f"[middleware] 접근 URL: {request.path}, 사용자: {request.user.username}"
            )

            # 관리자 페이지 접근 제한
            if request.path.startswith("/admin/") and not request.user.is_superuser:
                logger.warning(
                    f"[middleware] 관리자 권한 없는 사용자가 관리자 페이지 접근 시도: {request.user.username}"
                )
                return HttpResponseRedirect("/")

            # 학생 배치 페이지 접근 제한
            if request.path.startswith("/student-placement") and not (
                request.user.is_staff or request.user.is_superuser
            ):
                logger.warning(
                    f"[middleware] 관리자 권한 없는 사용자가 학생 배치 페이지 접근 시도: {request.user.username}"
                )
                return HttpResponseRedirect(f"/{request.user.id}/mypage")

            # 마이페이지 접근 제한 (다른 유저의 마이페이지)
            mypage_match = re.match(r"/mypage/(\d+)", request.path)
            if mypage_match and not request.user.is_superuser:
                user_id = int(mypage_match.group(1))
                if user_id != request.user.id:
                    logger.warning(
                        f"[middleware] 다른 사용자의 마이페이지 접근 시도: {request.user.username} -> {user_id}"
                    )
                    return HttpResponseRedirect(f"/mypage/{request.user.id}")

        # 요청 처리
        response = self.get_response(request)

        return response
