"""
로그인/로그아웃 시그널 처리

사용자의 로그인/로그아웃 이벤트를 감지하여:
1. 중복 로그인 방지 (기존 세션 무효화)
2. 로그인 이력 기록 (IP, 기기 정보 등)
3. 보안 이벤트 로깅
4. 세션 관리
"""

import logging
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.contrib.sessions.models import Session
from django.dispatch import receiver
from django.utils import timezone
from rest_framework.authtoken.models import Token

from .models import User, LoginHistory, UserSession
from .utils import ClientInfoExtractor, LoginSecurityUtils

logger = logging.getLogger("api.auth")


@receiver(user_logged_in)
def user_logged_in_handler(sender, request, user, **kwargs):
    """
    사용자 로그인 시 실행되는 시그널 핸들러

    주요 기능:
    1. 클라이언트 정보 추출 및 로깅
    2. 기존 세션 무효화 (중복 로그인 방지) - superuser 제외
    3. 새 세션 정보 저장
    4. 로그인 이력 기록
    5. 보안 이벤트 검사
    """
    try:
        logger.info(f"🔐 로그인 시그널 처리 시작: 사용자 {user.username}")

        # 중복 로그인 방지 우회 체크 (superuser, 테스트 사용자)
        should_bypass_duplicate_check = user.is_superuser or (
            hasattr(user, "username") and user.username.startswith("test_")
        )

        if should_bypass_duplicate_check:
            bypass_reason = "SuperUser" if user.is_superuser else "TestUser"
            logger.info(
                f"🔓 [{bypass_reason}] 중복 로그인 방지 우회: {user.username} (시그널 레벨)"
            )

            # 1. 클라이언트 정보 추출 (로깅용)
            client_info = ClientInfoExtractor.extract_client_info(request)
            log_suffix = "관리자" if user.is_superuser else "테스트"
            ClientInfoExtractor.log_client_info(
                client_info, user, f"로그인 ({log_suffix})"
            )

            # 2. 로그인 이력만 기록 (세션 무효화 없이)
            login_history = LoginHistory.objects.create(
                user=user,
                session_key=request.session.session_key,
                token_key=getattr(request, "_token_key", None),
                login_success=True,
                ip_address=client_info["ip_address"],
                forwarded_ip=client_info["forwarded_ip"],
                user_agent=client_info["user_agent"],
                device_type=client_info["device_type"],
                browser_name=client_info["browser_name"],
                os_name=client_info["os_name"],
                country=client_info["country"],
                city=client_info["city"],
                isp=client_info["isp"],
                # 우회 사용자는 기존 세션 종료 없음
                previous_session_terminated=False,
            )

            logger.info(f"✅ {bypass_reason} 로그인 이력 기록 완료: {user.username}")
            return  # 중복 로그인 방지 로직 건너뛰기

        # 일반 사용자 로그인 처리
        # 1. 클라이언트 정보 추출
        client_info = ClientInfoExtractor.extract_client_info(request)
        ClientInfoExtractor.log_client_info(client_info, user, "로그인")

        # 2. 보안 이벤트 검사
        suspicious_indicators = LoginSecurityUtils.is_suspicious_activity(
            user, client_info
        )
        if suspicious_indicators:
            LoginSecurityUtils.log_security_event(
                user,
                "SUSPICIOUS_LOGIN",
                client_info,
                f"의심 지표: {', '.join(suspicious_indicators)}",
            )

        # 3. 기존 세션/토큰 정보 확인 및 무효화 (일반 사용자만)
        previous_session_info = {}
        try:
            user_session = UserSession.objects.get(user=user)

            # 기존 세션이 있다면 종료 처리
            if user_session.session_key or user_session.token_key:
                previous_session_info = {
                    "previous_session_terminated": True,
                    "previous_login_ip": user_session.current_ip,
                }

                logger.info(
                    f"🔄 기존 세션 종료: 사용자 {user.username} | "
                    f"이전IP: {user_session.current_ip} | "
                    f"새IP: {client_info['ip_address']}"
                )

                # 기존 Django 세션 삭제
                if user_session.session_key:
                    try:
                        old_session = Session.objects.get(
                            session_key=user_session.session_key
                        )
                        old_session.delete()
                        logger.info(
                            f"✅ Django 세션 삭제 완료: {user_session.session_key[:10]}..."
                        )
                    except Session.DoesNotExist:
                        logger.warning(
                            f"⚠️ Django 세션이 이미 삭제됨: {user_session.session_key}"
                        )

                # 기존 토큰 삭제
                if user_session.token_key:
                    try:
                        old_token = Token.objects.get(key=user_session.token_key)
                        old_token.delete()
                        logger.info(
                            f"✅ 토큰 삭제 완료: {user_session.token_key[:10]}..."
                        )
                    except Token.DoesNotExist:
                        logger.warning(
                            f"⚠️ 토큰이 이미 삭제됨: {user_session.token_key}"
                        )

            # 새로운 세션 정보로 업데이트
            user_session.session_key = request.session.session_key
            user_session.token_key = getattr(request, "_token_key", None)
            user_session.current_ip = client_info["ip_address"]
            user_session.current_user_agent = client_info["user_agent"]
            user_session.current_device_type = client_info["device_type"]
            user_session.save()

            logger.info(f"🔄 세션 정보 업데이트 완료: {user.username}")

        except UserSession.DoesNotExist:
            # 첫 로그인 - 새로운 세션 생성
            user_session = UserSession.objects.create(
                user=user,
                session_key=request.session.session_key,
                token_key=getattr(request, "_token_key", None),
                current_ip=client_info["ip_address"],
                current_user_agent=client_info["user_agent"],
                current_device_type=client_info["device_type"],
            )

            logger.info(f"🆕 새 사용자 세션 생성: {user.username}")

        # 4. 로그인 이력 기록
        login_history = LoginHistory.objects.create(
            user=user,
            session_key=request.session.session_key,
            token_key=getattr(request, "_token_key", None),
            login_success=True,
            ip_address=client_info["ip_address"],
            forwarded_ip=client_info["forwarded_ip"],
            user_agent=client_info["user_agent"],
            device_type=client_info["device_type"],
            browser_name=client_info["browser_name"],
            os_name=client_info["os_name"],
            country=client_info["country"],
            city=client_info["city"],
            isp=client_info["isp"],
            **previous_session_info,
        )

        # 5. 성공 로그 기록
        logger.info(
            f"✅ 로그인 성공: {user.username} | "
            f"IP: {client_info['ip_address']} | "
            f"기기: {client_info['device_type']} | "
            f"브라우저: {client_info['browser_name']} | "
            f"OS: {client_info['os_name']}"
            f"{' | 기존세션종료' if previous_session_info.get('previous_session_terminated') else ''}"
        )

        # 보안 이벤트가 있는 경우 추가 로깅
        if suspicious_indicators:
            logger.warning(
                f"⚠️ 의심스러운 로그인: {user.username} | "
                f"지표: {', '.join(suspicious_indicators)}"
            )

    except Exception as e:
        # 시그널 처리 실패 시에도 로그인은 정상 진행되도록 함
        logger.error(
            f"❌ 로그인 시그널 처리 오류: {user.username} | " f"오류: {str(e)}"
        )

        # 기본 로그인 이력이라도 기록
        try:
            LoginHistory.objects.create(
                user=user,
                login_success=True,
                ip_address=request.META.get("REMOTE_ADDR", "unknown"),
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
                device_type="unknown",
                browser_name="unknown",
                os_name="unknown",
                failure_reason=f"시그널 처리 오류: {str(e)}",
            )
        except:
            pass  # 로그인 이력 기록마저 실패하면 조용히 무시


@receiver(user_logged_out)
def user_logged_out_handler(sender, request, user, **kwargs):
    """
    사용자 로그아웃 시 실행되는 시그널 핸들러

    주요 기능:
    1. 세션 정보 정리
    2. 로그아웃 이력 기록
    3. 보안 로깅
    """
    if not user:
        logger.warning("⚠️ 로그아웃 시그널에서 사용자 정보 없음")
        return

    try:
        logger.info(f"🔓 로그아웃 시그널 처리 시작: 사용자 {user.username}")

        # 1. 클라이언트 정보 추출
        client_info = ClientInfoExtractor.extract_client_info(request)

        # 2. 세션 정보 정리
        try:
            user_session = UserSession.objects.get(user=user)

            # 세션 무효화
            user_session.invalidate()

            logger.info(f"🔄 세션 무효화 완료: {user.username}")

        except UserSession.DoesNotExist:
            logger.warning(f"⚠️ 로그아웃 시 UserSession 없음: {user.username}")

        # 3. 로그아웃 이력 업데이트
        # 최근 로그인 이력 중에서 로그아웃 시간이 기록되지 않은 것을 찾아 업데이트
        recent_login = (
            user.login_history.filter(logout_at__isnull=True, login_success=True)
            .order_by("-login_at")
            .first()
        )

        if recent_login:
            recent_login.logout_at = timezone.now()
            recent_login.logout_reason = "manual_logout"
            recent_login.save()

            # 세션 지속 시간 계산
            session_duration = recent_login.session_duration
            duration_str = (
                f" | 세션시간: {session_duration}" if session_duration else ""
            )

            logger.info(
                f"✅ 로그아웃 완료: {user.username} | "
                f"IP: {client_info['ip_address']}"
                f"{duration_str}"
            )
        else:
            logger.warning(f"⚠️ 로그아웃할 로그인 이력을 찾을 수 없음: {user.username}")

    except Exception as e:
        logger.error(
            f"❌ 로그아웃 시그널 처리 오류: {user.username if user else 'unknown'} | "
            f"오류: {str(e)}"
        )


def record_failed_login(request, username, failure_reason):
    """
    로그인 실패 시 호출되는 함수 (뷰에서 직접 호출)

    Args:
        request: HTTP 요청 객체
        username: 로그인 시도한 사용자명
        failure_reason: 실패 사유
    """
    try:
        logger.warning(f"🔒 로그인 실패: {username} | 사유: {failure_reason}")

        # 클라이언트 정보 추출
        client_info = ClientInfoExtractor.extract_client_info(request)
        ClientInfoExtractor.log_client_info(
            client_info, None, f"로그인실패({failure_reason})"
        )

        # 사용자 조회 (실패해도 이력은 기록)
        user = None
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            logger.info(f"🔍 존재하지 않는 사용자명으로 로그인 시도: {username}")

        # 로그인 실패 이력 기록
        LoginHistory.objects.create(
            user=user,  # 사용자가 없으면 None
            login_success=False,
            failure_reason=failure_reason,
            ip_address=client_info["ip_address"],
            forwarded_ip=client_info["forwarded_ip"],
            user_agent=client_info["user_agent"],
            device_type=client_info["device_type"],
            browser_name=client_info["browser_name"],
            os_name=client_info["os_name"],
            country=client_info["country"],
            city=client_info["city"],
            isp=client_info["isp"],
        )

        # 보안 이벤트 로깅 (사용자가 존재하는 경우)
        if user:
            LoginSecurityUtils.log_security_event(
                user, "LOGIN_FAILED", client_info, failure_reason
            )

    except Exception as e:
        logger.error(f"❌ 로그인 실패 기록 오류: {username} | 오류: {str(e)}")


def force_logout_user(user, reason="duplicate_login"):
    """
    사용자를 강제로 로그아웃시키는 함수

    Args:
        user: 로그아웃할 사용자 객체
        reason: 강제 로그아웃 사유
    """
    try:
        logger.warning(f"🚨 강제 로그아웃: {user.username} | 사유: {reason}")

        # 세션 정보 조회 및 무효화
        try:
            user_session = UserSession.objects.get(user=user)

            # Django 세션 삭제
            if user_session.session_key:
                try:
                    old_session = Session.objects.get(
                        session_key=user_session.session_key
                    )
                    old_session.delete()
                except Session.DoesNotExist:
                    pass

            # 토큰 삭제
            if user_session.token_key:
                try:
                    old_token = Token.objects.get(key=user_session.token_key)
                    old_token.delete()
                except Token.DoesNotExist:
                    pass

            # 세션 무효화
            user_session.invalidate()

        except UserSession.DoesNotExist:
            pass

        # 로그아웃 이력 업데이트
        recent_login = (
            user.login_history.filter(logout_at__isnull=True, login_success=True)
            .order_by("-login_at")
            .first()
        )

        if recent_login:
            recent_login.logout_at = timezone.now()
            recent_login.logout_reason = reason
            recent_login.save()

        logger.info(f"✅ 강제 로그아웃 완료: {user.username}")

    except Exception as e:
        logger.error(f"❌ 강제 로그아웃 오류: {user.username} | 오류: {str(e)}")
