"""
이 파일은 API 요청을 처리하는 뷰 집합을 정의합니다.
사용자 인증, 학생 관리, 과목/시간 관리, 클리닉 및 코멘트 기능에 대한
REST API 엔드포인트를 제공합니다.
"""

from django.shortcuts import render, redirect
from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.db import transaction
from core.models import (
    # Student,  # Student 모델 삭제로 주석처리
    Subject,
    # Time,  # 보충 시스템 개편으로 주석처리
    Clinic,
    # Comment,  # 보충 시스템 개편으로 주석처리
    User,
    StudentPlacement,
    WeeklyReservationPeriod,  # 주간 예약 기간 관리
)
from .serializers import (
    UserSerializer,
    # StudentSerializer,  # Student 모델 삭제로 주석처리
    SubjectSerializer,
    # TimeSerializer,  # 보충 시스템 개편으로 주석처리
    ClinicSerializer,
    # CommentSerializer,  # 보충 시스템 개편으로 주석처리
    UserRegistrationSerializer,
    LoginSerializer,
    StudentPlacementSerializer,
    StudentPlacementUpdateSerializer,
    StudentUserGenerationSerializer,  # 새로 추가
    WeeklyReservationPeriodSerializer,  # 주간 예약 기간 serializer 추가
)
import logging
import traceback
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse
import pandas as pd
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os
from django.db.models import Q
from datetime import datetime
from django.conf import settings
from core.utils import (
    with_reservation_lock,
    with_rate_limit,
    log_performance,
    ClinicReservationOptimizer,
    DatabaseOptimizer,
)

# 로거 설정
logger = logging.getLogger("api.auth")
mypage_logger = logging.getLogger("mypage")

# Create your views here.


class UserViewSet(viewsets.ModelViewSet):
    """사용자 뷰셋 - 읽기 전용"""

    queryset = User.objects.all().order_by("id")  # 페이지네이션을 위한 순서 지정
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """요청 파라미터에 따라 필터링된 사용자 목록 반환"""
        queryset = User.objects.all().order_by("id")  # 페이지네이션을 위한 순서 지정

        # students 엔드포인트로 접근한 경우 기본적으로 학생만 필터링 (backward compatibility)
        if hasattr(self, "basename") and self.basename == "students":
            queryset = queryset.filter(is_student=True)

        # 활성화된 사용자만 필터링
        # is_activated = self.request.query_params.get("is_activated")  # 보충 시스템 개편으로 주석처리 - 더 이상 사용되지 않는 필드
        # if is_activated is not None:
        #     queryset = queryset.filter(is_activated=(is_activated.lower() == "true"))

        # 관리자만 필터링
        # is_manager = self.request.query_params.get("is_manager")  # 보충 시스템 개편으로 주석처리 - 더 이상 사용되지 않는 필드
        # if is_manager is not None:
        #     queryset = queryset.filter(is_manager=(is_manager.lower() == "true"))

        # 활성 상태 필터링
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=(is_active.lower() == "true"))

        # 강사 필터링 (새로 추가)
        is_teacher = self.request.query_params.get("is_teacher")
        if is_teacher is not None:
            queryset = queryset.filter(is_teacher=(is_teacher.lower() == "true"))

        # 슈퍼유저 필터링 (새로 추가)
        is_superuser = self.request.query_params.get("is_superuser")
        if is_superuser is not None:
            queryset = queryset.filter(is_superuser=(is_superuser.lower() == "true"))

        # 학생 사용자 필터링 (새로 추가)
        is_student = self.request.query_params.get("is_student")
        if is_student is not None:
            queryset = queryset.filter(is_student=(is_student.lower() == "true"))

        logger.info(f"[api/views.py] 사용자 조회 결과: {queryset.count()} 명")

        return queryset

    @action(detail=False, methods=["post"])
    def upload_student_excel(self, request):
        """학생 명단 엑셀 파일로 학생 사용자(is_student=True) 추가"""
        logger.info("[api/views.py] 학생 명단 엑셀 파일 업로드 시작")

        if "file" not in request.FILES:
            return Response(
                {"error": "파일이 업로드되지 않았습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        excel_file = request.FILES["file"]

        # 파일 확장자 검증
        if not excel_file.name.endswith((".xlsx", ".xls")):
            return Response(
                {"error": "엑셀 파일(.xlsx, .xls)만 업로드 가능합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # 임시 파일 저장
            file_name = default_storage.save(
                f"temp/{excel_file.name}", ContentFile(excel_file.read())
            )
            file_path = default_storage.path(file_name)

            # 엑셀 파일 읽기
            df = pd.read_excel(file_path)
            logger.info(f"[api/views.py] 학생 명단 엑셀 파일 읽기 완료: {len(df)}행")

            # 최소 필요 컬럼 수 확인 (학교, 학년, 이름, 학부모전화번호 = 4개 필수)
            if len(df.columns) < 4:
                default_storage.delete(file_name)
                return Response(
                    {
                        "error": "학생 명단 양식이 올바르지 않습니다. 최소 4개 컬럼(학교, 학년, 이름, 학부모전화번호)이 필요합니다."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 데이터 처리 결과 저장
            results = {
                "total_rows": len(df),
                "added_students": [],
                "duplicate_students": [],
                "error_students": [],
            }

            # 각 행 처리
            for index, row in df.iterrows():
                try:
                    # 프론트엔드 양식에 맞는 컬럼 순서로 데이터 추출
                    # 0: 학교, 1: 학년, 2: 이름, 3: 학생전화번호(선택), 4: 학부모전화번호(필수)
                    school = str(row.iloc[0]).strip() if len(row) > 0 else ""
                    grade = str(row.iloc[1]).strip() if len(row) > 1 else ""
                    name = str(row.iloc[2]).strip() if len(row) > 2 else ""

                    # 전화번호 처리 - 앞의 0이 잘리는 문제 해결
                    # 학생 전화번호 (선택사항)
                    student_phone_raw = row.iloc[3] if len(row) > 3 else ""
                    if pd.isna(student_phone_raw):
                        student_phone = ""
                    else:
                        if isinstance(student_phone_raw, (int, float)):
                            student_phone = str(int(student_phone_raw)).zfill(11)
                        else:
                            student_phone = str(student_phone_raw).strip()

                        if len(student_phone) == 10 and student_phone.startswith("1"):
                            student_phone = "0" + student_phone

                    # 학부모 전화번호 (필수)
                    parent_phone_raw = row.iloc[4] if len(row) > 4 else ""
                    if pd.isna(parent_phone_raw):
                        parent_phone = ""
                    else:
                        if isinstance(parent_phone_raw, (int, float)):
                            parent_phone = str(int(parent_phone_raw)).zfill(11)
                        else:
                            parent_phone = str(parent_phone_raw).strip()

                        if len(parent_phone) == 10 and parent_phone.startswith("1"):
                            parent_phone = "0" + parent_phone

                    # 빈 값 검증 (학생 전화번호는 선택사항)
                    if not all([school, grade, name, parent_phone]):
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": "학교, 학년, 이름, 학부모 전화번호는 필수입니다.",
                            }
                        )
                        continue

                    # 이름 유효성 검사 (숫자 포함 여부)
                    if any(char.isdigit() for char in name):
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": f"이름에 숫자가 포함될 수 없습니다: {name}",
                            }
                        )
                        continue

                    # 전화번호 유효성 검사 (학생, 학부모)
                    def is_valid_phone(phone):
                        if not phone:  # 비어있는 경우 유효
                            return True
                        phone_digits = phone.replace("-", "")
                        return phone_digits.isdigit() and len(phone_digits) in [10, 11]

                    if not is_valid_phone(student_phone):
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": f"학생 전화번호 형식이 올바르지 않습니다: {student_phone}",
                            }
                        )
                        continue

                    if not is_valid_phone(parent_phone):
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": f"학부모 전화번호 형식이 올바르지 않습니다: {parent_phone}",
                            }
                        )
                        continue

                    # 학교명 정규화
                    if school in ["세화고등학교", "세화고"]:
                        school = "세화고"
                    elif school in ["세화여자고등학교", "세화여고"]:
                        school = "세화여고"
                    elif school in ["연합반"]:
                        school = "연합반"
                    else:
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": f"지원하지 않는 학교입니다: {school}",
                            }
                        )
                        continue

                    # 학년 정규화
                    if grade in ["1", "1학년"]:
                        grade = "1학년"
                    elif grade in ["2", "2학년"]:
                        grade = "2학년"
                    elif grade in ["3", "3학년"]:
                        grade = "3학년"
                    else:
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": f"지원하지 않는 학년입니다: {grade}",
                            }
                        )
                        continue

                    # 중복 검사 (학교, 학년, 이름, 학부모번호로 확인)
                    existing_user = User.objects.filter(
                        is_student=True,
                        school=school,
                        grade=grade,
                        name=name,
                        student_parent_phone_num=parent_phone,
                    ).first()

                    if existing_user:
                        results["duplicate_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "school": school,
                                "grade": grade,
                                "existing_id": existing_user.id,
                            }
                        )
                        continue

                    # 8자리 학생 ID 생성
                    def generate_student_username(school, grade, user_id):
                        # 현재 연도의 마지막 2자리
                        current_year = "25"  # 2025년

                        # 학교 코드 매핑
                        school_code_map = {
                            "세화고": "01",
                            "세화여고": "02",
                            "연합반": "03",
                        }

                        # 학년 코드 매핑
                        grade_code_map = {
                            "예비고1": "0",
                            "1학년": "1",
                            "2학년": "2",
                            "3학년": "3",
                        }

                        school_code = school_code_map.get(school, "99")
                        grade_code = grade_code_map.get(grade, "9")

                        # 사용자 ID를 3자리로 변환 (예: 1 -> 001)
                        user_id_padded = str(user_id).zfill(3)

                        # 8자리 ID 생성
                        return (
                            f"{current_year}{school_code}{grade_code}{user_id_padded}"
                        )

                    # 기본 과목을 physics1으로 설정
                    default_subject = None
                    try:
                        default_subject = Subject.objects.filter(
                            subject="physics1"
                        ).first()
                        if not default_subject:
                            default_subject = Subject.objects.first()
                    except Subject.DoesNotExist:
                        pass

                    # 새 학생 사용자 생성
                    new_user = User.objects.create_user(
                        username=f"temp_{name}_{index}",  # 임시 username (나중에 실제 ID로 변경)
                        name=name,
                        phone_num=student_phone,
                        student_phone_num=student_phone,
                        student_parent_phone_num=parent_phone,
                        school=school,
                        grade=grade,
                        subject=default_subject,
                        is_student=True,
                        is_teacher=False,
                        is_staff=False,
                        is_superuser=False,
                        password=f"temp_{name}_{index}",  # 임시 비밀번호 (나중에 변경)
                    )

                    # 실제 8자리 학생 ID 생성 및 업데이트
                    student_username = generate_student_username(
                        school, grade, new_user.id
                    )
                    new_user.username = student_username
                    new_user.set_password(
                        student_username
                    )  # 비밀번호를 학생 ID와 동일하게 설정
                    new_user.save()

                    results["added_students"].append(
                        {
                            "id": new_user.id,
                            "name": name,
                            "school": school,
                            "grade": grade,
                            "username": student_username,
                        }
                    )

                    logger.info(
                        f"[api/views.py] 새 학생 사용자 추가: {name} ({school} {grade}) - ID: {student_username}"
                    )

                except Exception as e:
                    error_msg = str(e)
                    logger.error(
                        f"[api/views.py] 행 {index + 2} 처리 오류: {error_msg}"
                    )
                    results["error_students"].append(
                        {
                            "row": index + 2,
                            "name": name if "name" in locals() else "알 수 없음",
                            "error": error_msg,
                        }
                    )

            # 임시 파일 삭제
            default_storage.delete(file_name)

            logger.info(
                f"[api/views.py] 엑셀 업로드 완료: 추가 {len(results['added_students'])}명, 중복 {len(results['duplicate_students'])}명, 오류 {len(results['error_students'])}명"
            )

            return Response(results, status=status.HTTP_200_OK)

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[api/views.py] 엑셀 파일 처리 오류: {error_msg}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")

            # 임시 파일 삭제 (오류 발생 시에도)
            try:
                if "file_name" in locals():
                    default_storage.delete(file_name)
            except:
                pass

            return Response(
                {"error": f"파일 처리 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# StudentViewSet 완전 삭제 - Student 모델 통합으로 인해 더 이상 필요하지 않음
# User 모델에서 is_student=True인 사용자들이 학생 역할을 수행
# 학생 관련 기능은 UserViewSet에서 is_student 필터링으로 처리


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer


# 보충 시스템 개편으로 주석처리
# class TimeViewSet(viewsets.ModelViewSet):
#     queryset = Time.objects.all()
#     serializer_class = TimeSerializer


class ClinicViewSet(viewsets.ModelViewSet):
    queryset = Clinic.objects.all().order_by(
        "-id"
    )  # 페이지네이션을 위한 순서 지정 (최신순)
    serializer_class = ClinicSerializer

    def get_queryset(self):
        """요청 파라미터에 따라 필터링된 클리닉 목록 반환"""
        queryset = Clinic.objects.all().order_by(
            "-id"
        )  # 페이지네이션을 위한 순서 지정 (최신순)

        # 특정 선생님의 클리닉만 필터링
        teacher_id = self.request.query_params.get("teacher_id")
        if teacher_id is not None:
            queryset = queryset.filter(clinic_teacher_id=teacher_id)

        # 특정 요일의 클리닉만 필터링
        clinic_day = self.request.query_params.get("clinic_day")
        if clinic_day is not None:
            queryset = queryset.filter(clinic_day=clinic_day)

        return queryset

    @action(detail=False, methods=["post"])
    @with_rate_limit(action="clinic_reservation", limit=5, window=60)
    @log_performance("클리닉 예약")
    def reserve_clinic(self, request):
        """
        학생이 클리닉을 예약하는 API (선착순 시스템)
        동시접속 보호: Rate limiting, 성능 로깅 적용
        """
        logger.info("[api/views.py] 클리닉 예약 요청 시작")

        try:
            # 요청 데이터 추출
            user_id = request.data.get("user_id")
            clinic_id = request.data.get("clinic_id")

            if not user_id or not clinic_id:
                return Response(
                    {"error": "user_id와 clinic_id가 필요합니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 사용자 및 클리닉 유효성 검사
            try:
                # user = User.objects.get(id=user_id, is_student=True)  # 보충 시스템 개편으로 주석처리 - 모든 사용자 예약 가능
                user = User.objects.get(
                    id=user_id
                )  # 모든 종류의 사용자가 클리닉 예약 가능 (학생 < 강사 < 관리자 < 슈퍼유저)
                clinic = DatabaseOptimizer.get_clinic_with_lock(clinic_id)
            except User.DoesNotExist:
                return Response(
                    # {"error": "유효하지 않은 학생 사용자입니다."},  # 보충 시스템 개편으로 주석처리
                    {
                        "error": "유효하지 않은 사용자입니다."
                    },  # 모든 사용자 대상으로 메시지 변경
                    status=status.HTTP_404_NOT_FOUND,
                )
            except Clinic.DoesNotExist:
                return Response(
                    {"error": "유효하지 않은 클리닉입니다."},
                    status=status.HTTP_404_NOT_FOUND,
                )

                # 클리닉 활성화 상태 확인 (간단한 시스템)
            if not clinic.is_active:
                return Response(
                    {
                        "error": "reservation_closed",
                        "message": "보충 예약 가능 기간이 아닙니다.",
                        "clinic_status": "inactive",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 트랜잭션 내에서 예약 처리 (동시성 문제 방지)
            with transaction.atomic():
                # 이미 예약했는지 확인
                if clinic.clinic_students.filter(id=user_id).exists():
                    return Response(
                        {"error": "이미 해당 클리닉에 예약되어 있습니다."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # 정원 확인
                if clinic.is_full():
                    logger.warning(
                        f"[api/views.py] 클리닉 정원 초과: clinic_id={clinic_id}, "
                        f"current={clinic.get_current_students_count()}, capacity={clinic.clinic_capacity}"
                    )
                    return Response(
                        {
                            "error": "occupied",
                            "message": "해당 시간대는 이미 마감되었습니다.",
                            "current_count": clinic.get_current_students_count(),
                            "capacity": clinic.clinic_capacity,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                    # 예약 성공
                clinic.clinic_students.add(user)

                # 예약 성공 시 캐시 무효화
                ClinicReservationOptimizer.invalidate_clinic_cache(clinic_id)

                logger.info(
                    f"[api/views.py] 클리닉 예약 성공: user_id={user_id}, "
                    f"clinic_id={clinic_id}, user_name={user.name}"
                )

                return Response(
                    {
                        "success": True,
                        "message": "클리닉 예약이 완료되었습니다.",
                        "clinic_info": {
                            "id": clinic.id,
                            "day": clinic.get_clinic_day_display(),
                            "time": clinic.clinic_time,
                            "room": clinic.clinic_room,
                            "subject": clinic.clinic_subject.subject,
                            "teacher": clinic.clinic_teacher.name,
                        },
                        "remaining_spots": clinic.get_remaining_spots(),
                    },
                    status=status.HTTP_200_OK,
                )

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[api/views.py] 클리닉 예약 오류: {error_msg}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")

            return Response(
                {"error": f"클리닉 예약 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["post"])
    def cancel_reservation(self, request):
        """
        학생이 클리닉 예약을 취소하는 API
        """
        logger.info("[api/views.py] 클리닉 예약 취소 요청 시작")

        try:
            user_id = request.data.get("user_id")
            clinic_id = request.data.get("clinic_id")

            if not user_id or not clinic_id:
                return Response(
                    {"error": "user_id와 clinic_id가 필요합니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 사용자 및 클리닉 유효성 검사
            try:
                # user = User.objects.get(id=user_id, is_student=True)  # 보충 시스템 개편으로 주석처리 - 모든 사용자 예약 취소 가능
                user = User.objects.get(
                    id=user_id
                )  # 모든 종류의 사용자가 클리닉 예약 취소 가능 (학생 < 강사 < 관리자 < 슈퍼유저)
                clinic = Clinic.objects.get(id=clinic_id)
            except User.DoesNotExist:
                return Response(
                    # {"error": "유효하지 않은 학생 사용자입니다."},  # 보충 시스템 개편으로 주석처리
                    {
                        "error": "유효하지 않은 사용자입니다."
                    },  # 모든 사용자 대상으로 메시지 변경
                    status=status.HTTP_404_NOT_FOUND,
                )
            except Clinic.DoesNotExist:
                return Response(
                    {"error": "유효하지 않은 클리닉입니다."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # 예약되어 있는지 확인
            if not clinic.clinic_students.filter(id=user_id).exists():
                return Response(
                    {"error": "해당 클리닉에 예약되어 있지 않습니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

                # 예약 취소
            clinic.clinic_students.remove(user)

            # 예약 취소 시 캐시 무효화
            ClinicReservationOptimizer.invalidate_clinic_cache(clinic_id)

            logger.info(
                f"[api/views.py] 클리닉 예약 취소 성공: user_id={user_id}, "
                f"clinic_id={clinic_id}, user_name={user.name}"
            )

            return Response(
                {
                    "success": True,
                    "message": "클리닉 예약이 취소되었습니다.",
                    "remaining_spots": clinic.get_remaining_spots(),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[api/views.py] 클리닉 예약 취소 오류: {error_msg}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")

            return Response(
                {"error": f"클리닉 예약 취소 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["get"])
    @log_performance("주간 스케줄 조회")
    def weekly_schedule(self, request):
        """
        주간 클리닉 스케줄 조회 API (5x4 그리드 데이터)
        성능 최적화: 캐싱, 쿼리 최적화 적용
        """
        logger.info("[api/views.py] 주간 클리닉 스케줄 조회 시작")

        # 캐시된 데이터 확인
        cached_data = ClinicReservationOptimizer.get_cached_schedule()
        if cached_data:
            logger.info("[api/views.py] 캐시된 스케줄 데이터 반환")
            return Response(cached_data, status=status.HTTP_200_OK)

        try:
            # 최적화된 클리닉 데이터 조회
            clinics = DatabaseOptimizer.optimize_clinic_query()

            # DB에 실제로 존재하는 요일들만 동적으로 조회 (올바른 순서로 정렬)
            day_order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
            days_in_db_set = set(
                clinics.values_list("clinic_day", flat=True).distinct()
            )
            days_in_db = [day for day in day_order if day in days_in_db_set]
            times_in_db = list(
                clinics.values_list("clinic_time", flat=True)
                .distinct()
                .order_by("clinic_time")
            )

            # 기본값 설정 (DB에 데이터가 없는 경우)
            days = days_in_db if days_in_db else ["mon", "tue", "wed", "thu", "fri"]
            times = times_in_db if times_in_db else ["18:00", "19:00", "20:00", "21:00"]

            schedule_grid = {}

            for day in days:
                schedule_grid[day] = {}
                for time in times:
                    # 해당 요일/시간의 클리닉 찾기
                    clinic = clinics.filter(clinic_day=day, clinic_time=time).first()

                    if clinic:
                        schedule_grid[day][time] = {
                            "clinic_id": clinic.id,
                            "teacher_name": clinic.clinic_teacher.name,
                            "subject": clinic.clinic_subject.subject,
                            "room": clinic.clinic_room,
                            "capacity": clinic.clinic_capacity,
                            "current_count": clinic.get_current_students_count(),
                            "remaining_spots": clinic.get_remaining_spots(),
                            "is_full": clinic.is_full(),
                            "students": [
                                {
                                    "id": student.id,
                                    "name": student.name,
                                    "username": student.username,
                                }
                                for student in clinic.clinic_students.all()
                            ],
                        }
                    else:
                        schedule_grid[day][time] = {
                            "clinic_id": None,
                            "teacher_name": None,
                            "subject": None,
                            "room": None,
                            "capacity": 0,
                            "current_count": 0,
                            "remaining_spots": 0,
                            "is_full": False,
                            "students": [],
                        }

            logger.info(
                f"[api/views.py] 주간 클리닉 스케줄 조회 완료: {len(clinics)}개 클리닉"
            )

            response_data = {
                "schedule": schedule_grid,
                "days": days,
                "times": times,
                "total_clinics": len(clinics),
            }

            # 응답 데이터를 캐시에 저장 (5분간)
            ClinicReservationOptimizer.set_cached_schedule(response_data, timeout=300)
            logger.info("[api/views.py] 스케줄 데이터 캐시 저장 완료")

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[api/views.py] 주간 클리닉 스케줄 조회 오류: {error_msg}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")

            return Response(
                {"error": f"스케줄 조회 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        logger.info(f"[api/views.py] 로그인 시도: {request.data.get('username')}")

        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data["username"]
            password = serializer.validated_data["password"]

            logger.info(f"[api/views.py] 인증 시도: {username}")
            user = authenticate(request, username=username, password=password)

            if user:
                logger.info(
                    f"[api/views.py] 인증 성공: {username}, is_active={user.is_active}"
                )

                if user.is_active:
                    login(request, user)  # 세션 로그인도 추가
                    token, created = Token.objects.get_or_create(user=user)
                    logger.info(
                        f"[api/views.py] 토큰 생성/조회: {token.key[:5]}...{token.key[-5:]}"
                    )

                    # 사용자 권한에 따라 리다이렉트 경로 결정
                    redirect_path = None
                    if user.is_superuser:
                        # 슈퍼유저는 관리자 페이지로
                        pass
                    elif user.is_student:
                        # 학생은 클리닉 예약 페이지로 (우선순위 높음)
                        redirect_path = "/clinic/reserve"
                    elif (
                        user.is_staff and not user.is_superuser and not user.is_student
                    ):
                        # 관리자는 학생 배치 페이지로 (학생이 아닌 경우만)
                        redirect_path = "/student-placement"
                    elif (
                        user.is_teacher
                        and not user.is_superuser
                        and not user.is_manager
                    ):
                        # 일반 강사는 오늘의 클리닉 페이지로
                        redirect_path = "/clinic/"
                    elif user.is_teacher:
                        # 기타 강사는 마이페이지로
                        redirect_path = f"/mypage/{user.id}"

                    return Response(
                        {
                            "token": token.key,
                            "user": UserSerializer(user).data,
                            "redirect": redirect_path,
                        }
                    )
                else:
                    logger.warning(f"[api/views.py] 비활성화된 계정: {username}")
                    return Response(
                        {"error": "계정이 비활성화되어 있습니다."},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
            else:
                logger.warning(f"[api/views.py] 인증 실패: {username}")
                return Response(
                    {"error": "로그인 정보가 올바르지 않습니다."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            logger.warning(f"[api/views.py] 유효성 검사 실패: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"message": "로그아웃 되었습니다."}, status=status.HTTP_200_OK)


class UserMyPageView(APIView):
    """유저의 마이페이지 정보를 조회하는 뷰"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id=None):
        logger.info(
            f"[api/views.py] 마이페이지 접근 시도: user_id={user_id}, 요청자={request.user.username}"
        )

        # user_id를 정수로 변환
        try:
            user_id_int = int(user_id)
        except (ValueError, TypeError):
            logger.error(f"[api/views.py] 잘못된 user_id 형식: {user_id}")
            return Response(
                {"error": "잘못된 사용자 ID입니다."}, status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(
            f"[api/views.py] 권한 체크: request.user.id={request.user.id}, user_id_int={user_id_int}, is_superuser={request.user.is_superuser}"
        )

        # 요청한 사용자 본인이거나 슈퍼유저만 접근 허용
        if not (request.user.id == user_id_int or request.user.is_superuser):
            logger.warning(
                f"[api/views.py] 권한 없는 마이페이지 접근: {request.user.username} (id={request.user.id}) -> {user_id_int}"
            )
            return Response(
                {"error": "접근 권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN
            )

        # 해당 ID의 사용자 조회
        try:
            user = User.objects.get(id=user_id_int)
            logger.info(
                f"[api/views.py] 사용자 조회 성공: id={user_id_int}, username={user.username}"
            )
        except User.DoesNotExist:
            logger.error(f"[api/views.py] 사용자를 찾을 수 없음: id={user_id_int}")
            return Response(
                {"error": "해당 사용자를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # 강사 또는 관리자만 마이페이지 조회 가능
        if not (user.is_teacher or user.is_staff or user.is_superuser):
            logger.warning(
                f"[api/views.py] 권한 없는 사용자의 마이페이지 접근: id={user_id_int}, is_teacher={user.is_teacher}, is_staff={user.is_staff}"
            )
            return Response(
                {"error": "마이페이지에 접근할 권한이 없습니다."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 사용자 정보 반환
        serializer = UserSerializer(user)

        # 보충 시스템 개편으로 주석처리 - 더 이상 배정 개념 없음
        # # 배정된 학생 목록 조회
        # assigned_students = Student.objects.filter(assigned_teacher=user)
        # student_serializer = StudentSerializer(assigned_students, many=True)
        # logger.info(f"[api/views.py] 배정된 학생 수: {assigned_students.count()}")

        # 빈 학생 목록 반환 (추후 클리닉 예약 시스템으로 대체)
        assigned_students = []
        student_serializer = StudentSerializer(assigned_students, many=True)

        # 강사의 클리닉 정보 조회
        clinics = Clinic.objects.filter(clinic_teacher=user)
        clinic_serializer = ClinicSerializer(clinics, many=True)
        logger.info(f"[api/views.py] 클리닉 수: {clinics.count()}")

        logger.info(f"[api/views.py] 마이페이지 조회 성공: 사용자 ID {user_id_int}")

        return Response(
            {
                "user": serializer.data,
                "assigned_students": student_serializer.data,
                "clinics": clinic_serializer.data,
            }
        )


class UserRegistrationView(APIView):
    """사용자 등록을 처리하는 뷰"""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {"message": "사용자가 성공적으로 등록되었습니다."},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StudentPlacementView(viewsets.ViewSet):
    """학생 배치 관련 뷰"""

    permission_classes = [permissions.IsAuthenticated]  # 인증된 사용자만 접근 가능

    def list(self, request):
        try:
            logger.info("[api/views.py] StudentPlacementView.list 시작")
            logger.info(f"[api/views.py] 인증된 사용자: {request.user.username}")

            # 학생 데이터 로드 - User 모델에서 is_student=True인 사용자들
            students = User.objects.filter(is_student=True)
            logger.info(f"[api/views.py] 학생 데이터 로드 완료: {students.count()}명")

            # 학생 데이터 직렬화 - UserSerializer 사용 (is_student=True인 사용자들)
            student_serializer = UserSerializer(students, many=True)
            logger.info(
                f"[api/views.py] 학생 데이터 직렬화 완료: {len(student_serializer.data)}개"
            )
            logger.debug(
                f"[api/views.py] 학생 데이터 샘플: {student_serializer.data[:2]}"
            )

            # 교사 데이터 로드
            teachers = User.objects.filter(is_teacher=True)
            logger.info(f"[api/views.py] 교사 데이터 로드 완료: {teachers.count()}명")

            # 교사 데이터 직렬화
            teacher_serializer = UserSerializer(teachers, many=True)
            logger.info(
                f"[api/views.py] 교사 데이터 직렬화 완료: {len(teacher_serializer.data)}개"
            )
            logger.debug(
                f"[api/views.py] 교사 데이터 샘플: {teacher_serializer.data[:2]}"
            )

            # 과목 데이터 로드
            subjects = Subject.objects.all()
            logger.info(f"[api/views.py] 과목 데이터 로드 완료: {subjects.count()}개")

            # 과목 데이터 직렬화
            subject_serializer = SubjectSerializer(subjects, many=True)
            logger.info(
                f"[api/views.py] 과목 데이터 직렬화 완료: {len(subject_serializer.data)}개"
            )
            logger.debug(
                f"[api/views.py] 과목 데이터 샘플: {subject_serializer.data[:2]}"
            )

            # 배치 데이터 로드
            placements = StudentPlacement.objects.all()
            logger.info(f"[api/views.py] 배치 데이터 로드 완료: {placements.count()}개")

            # 배치 데이터 직렬화
            placement_serializer = StudentPlacementSerializer(placements, many=True)
            logger.info(
                f"[api/views.py] 배치 데이터 직렬화 완료: {len(placement_serializer.data)}개"
            )
            logger.debug(
                f"[api/views.py] 배치 데이터 샘플: {placement_serializer.data[:2]}"
            )

            response_data = {
                "students": student_serializer.data,
                "teachers": teacher_serializer.data,
                "subjects": subject_serializer.data,
                "placements": placement_serializer.data,
            }
            logger.info("[api/views.py] 응답 데이터 준비 완료")

            return Response(response_data)

        except Exception as e:
            logger.error(f"[api/views.py] 에러 발생: {str(e)}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=["post"])
    def update_placements(self, request):
        try:
            logger.info("[api/views.py] update_placements 시작")
            logger.info(f"[api/views.py] 요청 데이터: {request.data}")

            serializer = StudentPlacementUpdateSerializer(data=request.data)
            if not serializer.is_valid():
                logger.error(f"[api/views.py] 유효성 검사 실패: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                # 기존 배치 데이터 삭제
                deleted_count = StudentPlacement.objects.all().delete()[0]
                logger.info(
                    f"[api/views.py] 기존 배치 데이터 삭제 완료: {deleted_count}개"
                )

                # 새로운 배치 데이터 생성
                placements = []
                for placement_data in serializer.validated_data["placements"]:
                    placement = StudentPlacement.objects.create(**placement_data)
                    placements.append(placement)

                logger.info(
                    f"[api/views.py] 새로운 배치 데이터 생성 완료: {len(placements)}개"
                )

                # 직렬화된 데이터 반환
                placement_serializer = StudentPlacementSerializer(placements, many=True)
                return Response(placement_serializer.data)

        except Exception as e:
            logger.error(f"[api/views.py] 에러 발생: {str(e)}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# 보충 시스템 개편으로 주석처리 - 더 이상 개별 시간표 관리 없음
# class TeacherAvailableTimeUpdateView(APIView):
#     """선생님의 수업 가능 시간을 업데이트하는 뷰"""
#
#     permission_classes = [permissions.IsAuthenticated]
#
#     def patch(self, request, teacher_id):
#         """
#         선생님의 available_time을 업데이트하고 무결성 검사를 수행합니다.
#         """
#         return Response(
#             {"error": "보충 시스템 개편으로 이 기능은 더 이상 사용되지 않습니다."},
#             status=status.HTTP_410_GONE,
#         )


class TodayClinicView(APIView):
    """오늘의 클리닉 정보를 조회하는 뷰"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """오늘의 요일에 맞는 클리닉 정보를 반환"""
        try:
            logger.info("[api/views.py] TodayClinicView.get 시작")

            # 오늘의 요일 확인
            today = datetime.now()
            weekday = today.weekday()  # 0=월요일, 1=화요일, ..., 6=일요일

            # 요일 매핑
            day_mapping = {
                0: "mon",
                1: "tue",
                2: "wed",
                3: "thu",
                4: "fri",
                5: "sat",
                6: "sun",
            }

            today_day = day_mapping.get(weekday, "mon")
            logger.info(f"[api/views.py] 오늘의 요일: {today_day} (weekday: {weekday})")

            # 오늘의 클리닉 조회
            clinics = Clinic.objects.filter(clinic_day=today_day)
            logger.info(f"[api/views.py] 오늘의 클리닉 수: {clinics.count()}")

            # 클리닉 데이터 직렬화
            clinic_serializer = ClinicSerializer(clinics, many=True)

            # 모든 학생 데이터 조회 (클리닉 관리를 위해) - User 모델 기반으로 변경
            students = User.objects.filter(is_student=True)
            student_serializer = UserSerializer(students, many=True)

            response_data = {
                "today": today_day,
                "today_korean": {
                    "mon": "월요일",
                    "tue": "화요일",
                    "wed": "수요일",
                    "thu": "목요일",
                    "fri": "금요일",
                    "sat": "토요일",
                    "sun": "일요일",
                }.get(today_day, ""),
                "clinics": clinic_serializer.data,
                "students": student_serializer.data,
            }

            logger.info(
                f"[api/views.py] 오늘의 클리닉 조회 완료: {len(clinic_serializer.data)}개"
            )

            return Response(response_data)

        except Exception as e:
            logger.error(f"[api/views.py] 오늘의 클리닉 조회 오류: {str(e)}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# 헬스체크 엔드포인트 - 기본 애플리케이션 상태 확인
class HealthCheckView(APIView):
    """
    시스템 상태를 확인하는 헬스체크 엔드포인트
    - 기본 애플리케이션 상태 확인 (DB 연결 테스트 제외)
    - Railway 배포시 빠른 헬스체크를 위해 단순화
    """

    permission_classes = [permissions.AllowAny]  # 인증 없이 접근 가능

    def get(self, request):
        """
        GET /api/health/
        기본 시스템 상태 확인 및 반환
        """
        # Railway 헬스체크 디버깅용 로그
        print(f"🏥 [HEALTH] === RAILWAY 헬스체크 시작 === {datetime.now()}")
        print(f"🏥 [HEALTH] 요청 HOST: {request.get_host()}")
        print(f"🏥 [HEALTH] 요청 경로: {request.path}")
        print(f"🏥 [HEALTH] 요청 메소드: {request.method}")
        print(f"🏥 [HEALTH] DEBUG 모드: {settings.DEBUG}")
        print(f"🏥 [HEALTH] ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")

        response_data = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "environment": "production" if not settings.DEBUG else "development",
            "message": "Application is running",
            "database": "checking...",
            "request_host": request.get_host(),
            "request_path": request.path,
        }

        try:
            print(f"🔍 [HEALTH] 헬스체크 시작 - {datetime.now()}")

            # 기본 Django 설정 확인
            response_data.update(
                {
                    "django_version": "5.0.2",
                    "debug_mode": settings.DEBUG,
                    "allowed_hosts": settings.ALLOWED_HOSTS,
                    "database_configured": bool(settings.DATABASES.get("default")),
                }
            )

            # 데이터베이스 연결 시도 (실패해도 healthy 상태 유지)
            try:
                from django.db import connection

                # 짧은 타임아웃으로 데이터베이스 연결 테스트
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    result = cursor.fetchone()

                # 데이터베이스 연결 성공
                user_count = User.objects.count()
                response_data.update(
                    {
                        "database": "connected",
                        "user_count": user_count,
                        "message": "All systems operational",
                    }
                )
                print(f"✅ [HEALTH] 데이터베이스 연결 성공: user_count={user_count}")

            except Exception as db_error:
                # 데이터베이스 연결 실패해도 애플리케이션은 healthy로 처리
                response_data.update(
                    {
                        "database": "disconnected",
                        "database_error": str(db_error),
                        "message": "Application running, database connection issue",
                    }
                )
                print(f"⚠️ [HEALTH] 데이터베이스 연결 실패 (앱은 정상): {db_error}")

            print(f"✅ [HEALTH] 기본 헬스체크 성공")
            print(f"🏥 [HEALTH] === RAILWAY 헬스체크 완료 === 200 OK")
            logger.info("[api/views.py] 헬스체크 성공 - 기본 상태 확인")
            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            error_msg = str(e)
            print(f"❌ [HEALTH] 헬스체크 실패: {error_msg}")
            print(f"🏥 [HEALTH] === RAILWAY 헬스체크 실패 === 503 SERVICE_UNAVAILABLE")

            response_data.update(
                {
                    "status": "unhealthy",
                    "error": error_msg,
                    "error_type": type(e).__name__,
                    "message": "Application health check failed",
                }
            )

            logger.error(f"[api/views.py] 헬스체크 실패: {error_msg}")
            return Response(response_data, status=status.HTTP_503_SERVICE_UNAVAILABLE)
