from django.http import HttpResponseRedirect, JsonResponse
from django.urls import resolve, reverse
from django.contrib.auth import logout
from django.contrib import messages
from django.utils import timezone
import re
import logging

from core.models import UserSession
from core.signals import force_logout_user
from core.utils import ClientInfoExtractor

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


class SingleSessionMiddleware:
    """중복 로그인 방지 미들웨어"""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        """
        각 요청마다 사용자의 세션 유효성을 체크합니다.
        중복 로그인이 감지되면 현재 세션을 무효화시킵니다.
        """

        # 테스트 사용자는 중복 로그인 체크 제외
        if (
            request.user.is_authenticated
            and hasattr(request.user, "username")
            and request.user.username.startswith("test_")
        ):
            # 테스트 사용자는 중복 로그인 체크를 건너뜀
            pass
        # 인증된 사용자만 체크
        elif request.user.is_authenticated:
            # 특정 경로는 체크에서 제외 (로그아웃, 헬스체크 등)
            excluded_paths = [
                "/api/auth/logout/",
                "/api/health/",
                "/admin/",  # Django 관리자는 별도 처리
            ]

            if not any(request.path.startswith(path) for path in excluded_paths):
                # 중복 로그인 체크 수행
                if self._check_session_validity(request):
                    # 세션이 유효하지 않은 경우 로그아웃 처리
                    return self._handle_invalid_session(request)
                else:
                    # 세션이 유효한 경우 마지막 활동 시간 업데이트
                    self._update_last_activity(request)

        # 정상 요청 처리
        response = self.get_response(request)
        return response

    def _check_session_validity(self, request):
        """
        세션 유효성 체크

        Returns:
            bool: True면 세션이 무효함 (로그아웃 필요), False면 유효함
        """
        try:
            user_session = UserSession.objects.get(user=request.user)

            # 현재 요청의 세션 키와 토큰 키 확인
            current_session_key = request.session.session_key
            current_token_key = self._extract_token_key(request)

            # 저장된 세션/토큰과 비교
            stored_session_key = user_session.session_key
            stored_token_key = user_session.token_key

            # 세션 키 체크 (세션 기반 인증)
            if current_session_key and stored_session_key:
                if current_session_key != stored_session_key:
                    logger.warning(
                        f"🚨 세션 키 불일치 감지: {request.user.username} | "
                        f"현재: {current_session_key[:10]}... | "
                        f"저장된: {stored_session_key[:10]}..."
                    )
                    return True  # 무효한 세션

            # 토큰 키 체크 (토큰 기반 인증)
            if current_token_key and stored_token_key:
                if current_token_key != stored_token_key:
                    logger.warning(
                        f"🚨 토큰 키 불일치 감지: {request.user.username} | "
                        f"현재: {current_token_key[:10]}... | "
                        f"저장된: {stored_token_key[:10]}..."
                    )
                    return True  # 무효한 토큰

            # 세션이 모두 None인 경우 (비정상 상태)
            if not stored_session_key and not stored_token_key:
                logger.warning(f"⚠️ 저장된 세션/토큰이 없음: {request.user.username}")
                return True  # 무효한 상태

            return False  # 유효한 세션

        except UserSession.DoesNotExist:
            # UserSession이 없는 경우 새로 생성
            logger.info(f"📝 UserSession 없음, 새로 생성: {request.user.username}")

            # 클라이언트 정보 추출
            client_info = ClientInfoExtractor.extract_client_info(request)

            # 새 세션 생성
            UserSession.objects.create(
                user=request.user,
                session_key=request.session.session_key,
                token_key=self._extract_token_key(request),
                current_ip=client_info["ip_address"],
                current_user_agent=client_info["user_agent"],
                current_device_type=client_info["device_type"],
            )

            return False  # 새로 생성된 세션은 유효

        except Exception as e:
            logger.error(
                f"❌ 세션 유효성 체크 오류: {request.user.username} | 오류: {str(e)}"
            )
            return False  # 오류 시에는 세션을 유효한 것으로 간주

    def _extract_token_key(self, request):
        """요청에서 토큰 키 추출"""
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Token "):
            return auth_header.split(" ")[1]
        return None

    def _handle_invalid_session(self, request):
        """무효한 세션 처리"""
        user = request.user

        logger.warning(f"🚫 중복 로그인 감지, 강제 로그아웃: {user.username}")

        # 클라이언트 정보 추출
        client_info = ClientInfoExtractor.extract_client_info(request)

        # 강제 로그아웃 처리
        force_logout_user(user, reason="duplicate_login")

        # Django 로그아웃
        logout(request)

        # API 요청인지 확인
        if (
            request.path.startswith("/api/")
            or request.headers.get("Content-Type") == "application/json"
        ):
            # API 요청인 경우 JSON 응답
            return JsonResponse(
                {
                    "error": "session_expired",
                    "message": "다른 곳에서 로그인하여 자동으로 로그아웃되었습니다.",
                    "reason": "duplicate_login",
                    "redirect": "/login",
                },
                status=401,
            )
        else:
            # 웹 페이지 요청인 경우 리다이렉트
            messages.warning(
                request, "다른 곳에서 로그인하여 자동으로 로그아웃되었습니다."
            )
            return HttpResponseRedirect("/login")

    def _update_last_activity(self, request):
        """마지막 활동 시간 업데이트"""
        try:
            user_session = UserSession.objects.get(user=request.user)
            user_session.last_activity = timezone.now()
            user_session.save(update_fields=["last_activity"])

        except UserSession.DoesNotExist:
            # UserSession이 없으면 생성하지 않음 (위에서 이미 처리됨)
            pass
        except Exception as e:
            # 마지막 활동 시간 업데이트 실패는 조용히 무시
            logger.debug(
                f"🔍 마지막 활동 시간 업데이트 실패: {request.user.username} | 오류: {str(e)}"
            )
