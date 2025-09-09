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
    ClinicAttendance,  # 클리닉 출석 모델
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
    ClinicAttendanceSerializer,  # 클리닉 출석 시리얼라이저
)
import logging
import traceback
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.http import JsonResponse

# pandas는 필요할 때만 임포트 (lazy loading)
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
excel_upload_logger = logging.getLogger(
    "api.excel_upload"
)  # 엑셀 업로드 전용 로거 추가

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

        # 활성 상태 필터링 - 기본적으로 활성화된 사용자만 반환
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=(is_active.lower() == "true"))
        else:
            # 쿼리 파라미터가 없으면 기본적으로 활성화된 사용자만 반환
            queryset = queryset.filter(is_active=True)

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

    @action(detail=True, methods=["patch"])
    def update_non_pass(self, request, pk=None):
        """학생의 의무 클리닉 상태(non_pass) 업데이트"""
        try:
            user = self.get_object()
            non_pass_status = request.data.get("non_pass")

            if non_pass_status is None:
                return Response(
                    {"error": "non_pass 값이 필요합니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # boolean 변환
            if isinstance(non_pass_status, str):
                non_pass_status = non_pass_status.lower() == "true"

            user.non_pass = non_pass_status
            user.save(update_fields=["non_pass"])

            logger.info(
                f"[api/views.py] non_pass 상태 업데이트: user_id={user.id}, "
                f"name={user.name}, non_pass={non_pass_status}"
            )

            return Response(
                {
                    "success": True,
                    "message": f"{user.name} 학생의 의무 클리닉 상태가 {'설정' if non_pass_status else '해제'}되었습니다.",
                    "user_id": user.id,
                    "name": user.name,
                    "non_pass": non_pass_status,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[api/views.py] non_pass 상태 업데이트 오류: {error_msg}")
            return Response(
                {"error": f"상태 업데이트 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["patch"])
    def update_essential_clinic(self, request, pk=None):
        """학생의 필수 클리닉 신청 상태(essential_clinic) 업데이트"""
        try:
            user = self.get_object()
            essential_clinic_status = request.data.get("essential_clinic")

            if essential_clinic_status is None:
                return Response(
                    {"error": "essential_clinic 값이 필요합니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # boolean 변환
            if isinstance(essential_clinic_status, str):
                essential_clinic_status = essential_clinic_status.lower() == "true"

            # non_pass=True인 학생은 essential_clinic을 False로 설정할 수 없음
            if user.non_pass and not essential_clinic_status:
                return Response(
                    {"error": "전 주 시험에서 Fail한 학생은 필수 클리닉 신청 취소를 끌 수 없습니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user.essential_clinic = essential_clinic_status
            user.save(update_fields=["essential_clinic"])

            logger.info(
                f"[api/views.py] essential_clinic 상태 업데이트: user_id={user.id}, "
                f"name={user.name}, essential_clinic={essential_clinic_status}"
            )

            return Response(
                {
                    "success": True,
                    "message": f"{user.name} 학생의 필수 클리닉 신청 상태가 {'설정' if essential_clinic_status else '해제'}되었습니다.",
                    "user_id": user.id,
                    "name": user.name,
                    "essential_clinic": essential_clinic_status,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[api/views.py] essential_clinic 상태 업데이트 오류: {error_msg}")
            return Response(
                {"error": f"상태 업데이트 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["post"])
    def upload_student_excel(self, request):
        """학생 명단 엑셀 파일로 학생 사용자(is_student=True) 추가"""
        excel_upload_logger.info("=== 학생 명단 엑셀 파일 업로드 시작 ===")
        excel_upload_logger.info(
            f"요청자: {request.user.username} (ID: {request.user.id})"
        )
        excel_upload_logger.info(f"요청 시간: {datetime.now()}")

        if "file" not in request.FILES:
            excel_upload_logger.error("업로드 실패: 파일이 제공되지 않음")
            return Response(
                {"error": "파일이 업로드되지 않았습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        excel_file = request.FILES["file"]
        excel_upload_logger.info(
            f"업로드된 파일: {excel_file.name} (크기: {excel_file.size} bytes)"
        )

        # 파일 확장자 검증
        if not excel_file.name.endswith((".xlsx", ".xls")):
            excel_upload_logger.error(
                f"업로드 실패: 지원하지 않는 파일 형식 - {excel_file.name}"
            )
            return Response(
                {"error": "엑셀 파일(.xlsx, .xls)만 업로드 가능합니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # 임시 파일 저장
            excel_upload_logger.info("엑셀 파일을 임시 저장소에 저장 중...")
            file_name = default_storage.save(
                f"temp/{excel_file.name}", ContentFile(excel_file.read())
            )
            file_path = default_storage.path(file_name)
            excel_upload_logger.info(f"임시 파일 저장 완료: {file_name}")

            # 엑셀 파일 읽기
            excel_upload_logger.info("엑셀 파일 데이터 읽기 시작...")
            try:
                import pandas as pd
            except ImportError as e:
                excel_upload_logger.error(f"pandas 임포트 실패: {str(e)}")
                return Response(
                    {
                        "error": "엑셀 처리를 위한 pandas 라이브러리를 불러올 수 없습니다."
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            df = pd.read_excel(file_path)
            excel_upload_logger.info(
                f"엑셀 파일 읽기 완료: {len(df)}행, {len(df.columns)}컬럼"
            )
            excel_upload_logger.info(f"컬럼 헤더: {list(df.columns)}")

            # 최소 필요 컬럼 수 확인 (학교, 학년, 이름, 학부모전화번호 = 4개 필수)
            if len(df.columns) < 4:
                excel_upload_logger.error(
                    f"업로드 실패: 컬럼 수 부족 - 현재 {len(df.columns)}개, 필요 4개 이상"
                )
                excel_upload_logger.error(f"제공된 컬럼: {list(df.columns)}")
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

            excel_upload_logger.info(f"=== 데이터 처리 시작: 총 {len(df)}행 ===")

            # 각 행 처리
            for index, row in df.iterrows():
                try:
                    # 현재 처리 중인 행 로그 (매 10행마다)
                    if index % 10 == 0:
                        excel_upload_logger.info(
                            f"처리 진행률: {index + 1}/{len(df)} 행"
                        )

                    # 프론트엔드 양식에 맞는 컬럼 순서로 데이터 추출
                    # 0: 학교, 1: 학년, 2: 이름, 3: 학생전화번호(선택), 4: 학부모전화번호(필수)
                    school = str(row.iloc[0]).strip() if len(row) > 0 else ""
                    grade = str(row.iloc[1]).strip() if len(row) > 1 else ""
                    name = str(row.iloc[2]).strip() if len(row) > 2 else ""

                    # 전화번호 처리 - 앞의 0이 잘리는 문제 해결
                    # 학부모 전화번호 (필수)
                    parent_phone_raw = row.iloc[3] if len(row) > 3 else ""
                    # pandas가 이미 import되어 있으므로 사용 (위에서 import됨)
                    if pd.isna(parent_phone_raw):
                        parent_phone = ""
                    else:
                        if isinstance(parent_phone_raw, (int, float)):
                            parent_phone = str(int(parent_phone_raw)).zfill(11)
                        else:
                            parent_phone = str(parent_phone_raw).strip()

                        if len(parent_phone) == 10 and parent_phone.startswith("1"):
                            parent_phone = "0" + parent_phone

                    # 학생 전화번호 (선택사항)
                    student_phone_raw = row.iloc[4] if len(row) > 4 else ""
                    if pd.isna(student_phone_raw):
                        student_phone = ""
                    else:
                        if isinstance(student_phone_raw, (int, float)):
                            student_phone = str(int(student_phone_raw)).zfill(11)
                        else:
                            student_phone = str(student_phone_raw).strip()

                        if len(student_phone) == 10 and student_phone.startswith("1"):
                            student_phone = "0" + student_phone

                    # 빈 값 검증 (학생 전화번호는 선택사항)
                    if not all([school, grade, name, parent_phone]):
                        error_msg = "학교, 학년, 이름, 학부모 전화번호는 필수입니다."
                        excel_upload_logger.warning(
                            f"행 {index + 2} 검증 실패 (필수값 누락): "
                            f"학교='{school}', 학년='{grade}', 이름='{name}', 학부모번호='{parent_phone}'"
                        )
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": error_msg,
                            }
                        )
                        continue

                    # 이름 유효성 검사 (숫자 포함 여부)
                    if any(char.isdigit() for char in name):
                        error_msg = f"이름에 숫자가 포함될 수 없습니다: {name}"
                        excel_upload_logger.warning(
                            f"행 {index + 2} 검증 실패 (이름 형식 오류): '{name}'"
                        )
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": error_msg,
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
                        error_msg = (
                            f"학생 전화번호 형식이 올바르지 않습니다: {student_phone}"
                        )
                        excel_upload_logger.warning(
                            f"행 {index + 2} 검증 실패 (학생 전화번호): '{student_phone}' - {name}"
                        )
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": error_msg,
                            }
                        )
                        continue

                    if not is_valid_phone(parent_phone):
                        error_msg = (
                            f"학부모 전화번호 형식이 올바르지 않습니다: {parent_phone}"
                        )
                        excel_upload_logger.warning(
                            f"행 {index + 2} 검증 실패 (학부모 전화번호): '{parent_phone}' - {name}"
                        )
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": error_msg,
                            }
                        )
                        continue

                    # 학교명 정규화
                    original_school = school
                    if school in ["세화고등학교", "세화고"]:
                        school = "세화고"
                    elif school in ["세화여자고등학교", "세화여고"]:
                        school = "세화여고"
                    elif school in ["연합반"]:
                        school = "연합반"
                    else:
                        error_msg = f"지원하지 않는 학교입니다: {school}"
                        excel_upload_logger.warning(
                            f"행 {index + 2} 검증 실패 (학교명 오류): '{original_school}' -> 지원되지 않음 - {name}"
                        )
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": error_msg,
                            }
                        )
                        continue

                    # 학년 정규화
                    original_grade = grade
                    if grade in ["1", "1학년"]:
                        grade = "1학년"
                    elif grade in ["2", "2학년"]:
                        grade = "2학년"
                    elif grade in ["3", "3학년"]:
                        grade = "3학년"
                    else:
                        error_msg = f"지원하지 않는 학년입니다: {grade}"
                        excel_upload_logger.warning(
                            f"행 {index + 2} 검증 실패 (학년 오류): '{original_grade}' -> 지원되지 않음 - {name}"
                        )
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": error_msg,
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
                        excel_upload_logger.warning(
                            f"행 {index + 2} 중복 사용자 발견: {name} ({school} {grade}) - "
                            f"기존 ID: {existing_user.id}, 전화번호: {parent_phone}"
                        )
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

                    # 9자리 학생 ID 생성 (연도2자리 + 학교구분2자리 + 학년1자리 + 부모님번호중간4자리)
                    def generate_student_username(school, grade, parent_phone):
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

                        # 부모님 전화번호에서 중간 4자리 추출
                        # 예: 010-1234-5678 또는 01012345678에서 1234 추출
                        phone_digits = parent_phone.replace("-", "").replace(" ", "")

                        # # 전화번호가 11자리인 경우 (010-1234-5678)
                        # if len(phone_digits) == 11:
                        #     middle_4_digits = phone_digits[3:7]  # 010 다음 4자리
                        # # 전화번호가 10자리인 경우 (예: 01012345678에서 0이 빠진 경우)
                        # elif len(phone_digits) == 10:
                        #     middle_4_digits = phone_digits[2:6]  # 앞 2자리 다음 4자리
                        # else:
                        #     # 전화번호 형식이 예상과 다른 경우 기본값 사용
                        #     middle_4_digits = "0000"

                        # 전화번호가 11자리인 경우 (010-1234-5678)
                        if len(phone_digits) == 11:
                            last_4_digits = phone_digits[7:11]  # 마지막 4자리
                        # 전화번호가 10자리인 경우 (예: 01012345678에서 0이 빠진 경우)
                        elif len(phone_digits) == 10:
                            last_4_digits = phone_digits[6:10]  # 마지막 4자리
                        else:
                            # 전화번호 형식이 예상과 다른 경우 기본값 사용
                            last_4_digits = "0000"

                        # 9자리 ID 생성
                        return f"{current_year}{school_code}{grade_code}{last_4_digits}"

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

                    # 실제 9자리 학생 ID 생성 및 업데이트
                    student_username = generate_student_username(
                        school, grade, parent_phone
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

                    excel_upload_logger.info(
                        f"행 {index + 2} 학생 추가 성공: {name} ({school} {grade}) - "
                        f"ID: {student_username}, 학생번호: {student_phone}, 학부모번호: {parent_phone}"
                    )

                except Exception as e:
                    error_msg = str(e)
                    error_type = type(e).__name__

                    # 로컬 변수들 추출 (오류 발생 시점의 데이터 확인)
                    debug_info = {
                        "school": school if "school" in locals() else "미정의",
                        "grade": grade if "grade" in locals() else "미정의",
                        "name": name if "name" in locals() else "미정의",
                        "student_phone": (
                            student_phone if "student_phone" in locals() else "미정의"
                        ),
                        "parent_phone": (
                            parent_phone if "parent_phone" in locals() else "미정의"
                        ),
                    }

                    excel_upload_logger.error(
                        f"행 {index + 2} 처리 중 예외 발생 ({error_type}): {error_msg}"
                    )
                    excel_upload_logger.error(f"행 {index + 2} 데이터: {debug_info}")
                    excel_upload_logger.error(
                        f"행 {index + 2} 원본 데이터: {row.to_dict()}"
                    )
                    excel_upload_logger.error(
                        f"행 {index + 2} 스택 트레이스:\n{traceback.format_exc()}"
                    )

                    results["error_students"].append(
                        {
                            "row": index + 2,
                            "name": name if "name" in locals() else "알 수 없음",
                            "error": f"{error_type}: {error_msg}",
                        }
                    )

            # 임시 파일 삭제
            default_storage.delete(file_name)
            excel_upload_logger.info("임시 파일 삭제 완료")

            # 최종 결과 로그
            excel_upload_logger.info("=== 엑셀 업로드 처리 완료 ===")
            excel_upload_logger.info(f"총 처리 행 수: {results['total_rows']}")
            excel_upload_logger.info(
                f"성공적으로 추가된 학생: {len(results['added_students'])}명"
            )
            excel_upload_logger.info(
                f"중복으로 제외된 학생: {len(results['duplicate_students'])}명"
            )
            excel_upload_logger.info(
                f"오류로 실패한 학생: {len(results['error_students'])}명"
            )

            # 성공률 계산
            success_rate = (
                (len(results["added_students"]) / results["total_rows"] * 100)
                if results["total_rows"] > 0
                else 0
            )
            excel_upload_logger.info(f"처리 성공률: {success_rate:.1f}%")

            # 오류가 있을 경우 오류 요약 로그
            if results["error_students"]:
                excel_upload_logger.warning(f"=== 오류 발생 행 요약 ===")
                for error_student in results["error_students"]:
                    excel_upload_logger.warning(
                        f"행 {error_student['row']}: {error_student['name']} - {error_student['error']}"
                    )

            return Response(results, status=status.HTTP_200_OK)

        except Exception as e:
            error_msg = str(e)
            error_type = type(e).__name__

            excel_upload_logger.error("=== 엑셀 업로드 전체 처리 실패 ===")
            excel_upload_logger.error(f"오류 유형: {error_type}")
            excel_upload_logger.error(f"오류 메시지: {error_msg}")
            excel_upload_logger.error(
                f"요청자: {request.user.username} (ID: {request.user.id})"
            )
            excel_upload_logger.error(
                f"파일명: {excel_file.name if 'excel_file' in locals() else '알 수 없음'}"
            )
            excel_upload_logger.error(f"스택 트레이스:\n{traceback.format_exc()}")

            # 임시 파일 삭제 (오류 발생 시에도)
            try:
                if "file_name" in locals():
                    default_storage.delete(file_name)
                    excel_upload_logger.info("오류 발생으로 인한 임시 파일 삭제 완료")
            except Exception as cleanup_error:
                excel_upload_logger.error(f"임시 파일 삭제 실패: {cleanup_error}")

            return Response(
                {"error": f"파일 처리 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer


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

            # 사용자 유효성 검사 (트랜잭션 외부에서 수행)
            try:
                user = User.objects.get(
                    id=user_id
                )  # 모든 종류의 사용자가 클리닉 예약 가능 (학생 < 강사 < 관리자 < 슈퍼유저)
            except User.DoesNotExist:
                return Response(
                    {
                        "error": "유효하지 않은 사용자입니다."
                    },  # 모든 사용자 대상으로 메시지 변경
                    status=status.HTTP_404_NOT_FOUND,
                )

            # 트랜잭션 내에서 클리닉 조회 및 예약 처리 (동시성 문제 방지)
            with transaction.atomic():
                # 클리닉 조회 (select_for_update를 트랜잭션 내에서 사용)
                try:
                    clinic = DatabaseOptimizer.get_clinic_with_lock(clinic_id)
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
                # 이미 예약했는지 확인
                if clinic.clinic_students.filter(id=user_id).exists():
                    return Response(
                        {"error": "이미 해당 클리닉에 예약되어 있습니다."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # 기존의 비활성화된 출석 데이터가 있다면 삭제 (unique 제약 조건 문제 해결)
                # 현재 주의 클리닉 날짜 계산
                from datetime import datetime, timedelta

                # 클리닉 요일을 숫자로 변환 (0=월요일, 6=일요일)
                clinic_day_map = {
                    "mon": 0,
                    "tue": 1,
                    "wed": 2,
                    "thu": 3,
                    "fri": 4,
                    "sat": 5,
                    "sun": 6,
                }

                clinic_weekday = clinic_day_map.get(clinic.clinic_day, 0)
                today = datetime.now().date()
                today_weekday = today.weekday()

                # 이번 주의 클리닉 날짜 계산
                days_until_clinic = clinic_weekday - today_weekday

                if days_until_clinic >= 0:
                    # 이번 주 클리닉 날짜 (오늘 포함)
                    expected_clinic_date = today + timedelta(days=days_until_clinic)
                else:
                    # 다음 주 클리닉 날짜
                    expected_clinic_date = today + timedelta(days=days_until_clinic + 7)

                # 기존의 비활성화된 출석 데이터 삭제 (unique 제약 조건 충돌 방지)
                existing_inactive_attendances = ClinicAttendance.objects.filter(
                    clinic=clinic,
                    student=user,
                    expected_clinic_date=expected_clinic_date,
                    is_active=False,
                )
                if existing_inactive_attendances.exists():
                    deleted_inactive_count = existing_inactive_attendances.count()
                    existing_inactive_attendances.delete()
                    logger.info(
                        f"[api/views.py] 클리닉 예약 - 기존 비활성화 출석 데이터 삭제: "
                        f"clinic_id={clinic_id}, student_id={user_id}, "
                        f"expected_clinic_date={expected_clinic_date}, count={deleted_inactive_count}"
                    )

                # no_show 체크 (학생만 해당, 2회 이상 무단결석한 학생은 예약 불가)
                if user.is_student and user.no_show >= 2:
                    logger.warning(
                        f"[api/views.py] 노쇼 학생 예약 차단: user_id={user_id}, "
                        f"user_name={user.name}, no_show_count={user.no_show}"
                    )
                    return Response(
                        {
                            "error": "no_show_blocked",
                            "message": f"{user.name} 학생은 {user.no_show}회 무단결석하여 금주 보충 예약이 불가능합니다.",
                            "no_show_count": user.no_show,
                            "user_name": user.name,
                        },
                        status=status.HTTP_403_FORBIDDEN,
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

                # 학생인 경우에만 ClinicAttendance 생성
                if user.is_student:
                    # 위에서 계산한 expected_clinic_date 재사용
                    ClinicAttendance.objects.create(
                        is_active=True,
                        clinic=clinic,
                        student=user,
                        attendance_type="none",
                        reservation_date=today,  # 오늘 날짜로 예약 날짜 설정
                        expected_clinic_date=expected_clinic_date,  # 위에서 계산된 예상 클리닉 날짜 사용
                    )
                    logger.info(
                        f"[api/views.py] 학생용 ClinicAttendance 생성 완료: user_id={user_id}"
                    )

                    # 의무 클리닉 대상자인 경우 non_pass를 False로 변경
                    if user.non_pass:
                        user.non_pass = False
                        user.save(update_fields=["non_pass"])
                        logger.info(
                            f"[api/views.py] 의무 클리닉 대상자 예약 완료: user_id={user_id}, "
                            f"non_pass를 False로 변경"
                        )
                else:
                    logger.info(
                        f"[api/views.py] 비학생 사용자는 ClinicAttendance 생성 안함: user_id={user_id}, name={user.name}"
                    )

                # 캐시 무효화 비활성화 (Railway 분산 환경 동기화 문제로 인해 임시 비활성화)
                # ClinicReservationOptimizer.invalidate_clinic_cache(clinic_id)

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
        클리닉 예약 취소 API - 완전히 비활성화
        모든 예약 취소는 관리자에게 문의 필요
        """
        logger.info("[api/views.py] 클리닉 예약 취소 요청 - 비활성화됨")

        # 모든 예약 취소 요청을 차단
        return Response(
            {
                "error": "cancellation_disabled",
                "message": "예약 취소는 관리자에게 문의하세요!",
                "admin_contact": "관리자 문의가 필요합니다.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

        # 기존 취소 로직은 모두 제거됨 - 관리자 문의 필요

    @action(detail=False, methods=["get"])
    @log_performance("주간 스케줄 조회")
    def weekly_schedule(self, request):
        """
        주간 클리닉 스케줄 조회 API (5x4 그리드 데이터)
        성능 최적화: 캐싱, 쿼리 최적화 적용
        """
        logger.info("[api/views.py] 주간 클리닉 스케줄 조회 시작")

        # 캐시 비활성화 (Railway 분산 환경 동기화 문제로 인해 임시 비활성화)
        # cached_data = ClinicReservationOptimizer.get_cached_schedule()
        # if cached_data:
        #     logger.info("[api/views.py] 캐시된 스케줄 데이터 반환")
        #     return Response(cached_data, status=status.HTTP_200_OK)

        try:
            # 최적화된 클리닉 데이터 조회 (활성화된 클리닉만)
            clinics = DatabaseOptimizer.optimize_clinic_query().filter(is_active=True)

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

            # 기본값 설정 (DB에 데이터가 없는 경우) - 토요일, 일요일까지 포함
            days = (
                days_in_db
                if days_in_db
                else ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
            )
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

            # 캐시 저장 비활성화 (Railway 분산 환경 동기화 문제로 인해 임시 비활성화)
            # ClinicReservationOptimizer.set_cached_schedule(response_data, timeout=300)
            # logger.info("[api/views.py] 스케줄 데이터 캐시 저장 완료")

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
        # 로그인 시도 기록을 위해 시그널 함수 import
        from core.signals import record_failed_login

        username = request.data.get("username", "")
        logger.info(f"[api/views.py] 로그인 시도: {username}")

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
                    # 기존 토큰이 있다면 삭제하고 새로 생성 (중복 로그인 방지)
                    Token.objects.filter(user=user).delete()
                    token = Token.objects.create(user=user)

                    # 시그널에서 사용할 수 있도록 토큰 키를 request에 저장
                    request._token_key = token.key

                    logger.info(
                        f"[api/views.py] 새 토큰 생성: {token.key[:5]}...{token.key[-5:]}"
                    )

                    # Django 세션 로그인 (시그널이 발동됨)
                    login(request, user)

                    # 초기 비밀번호 변경 필요 여부 확인 (학생 계정만)
                    needs_password_change = False
                    if user.is_student and user.check_password(user.username):
                        needs_password_change = True
                        logger.info(
                            f"[api/views.py] 초기 비밀번호 변경 필요: {user.username}"
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
                            "needs_password_change": needs_password_change,  # 초기 비밀번호 변경 필요 여부 추가
                        }
                    )
                else:
                    logger.warning(f"[api/views.py] 비활성화된 계정: {username}")
                    # 비활성화된 계정 로그인 시도 기록
                    record_failed_login(request, username, "account_inactive")
                    return Response(
                        {"error": "계정이 비활성화되어 있습니다."},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
            else:
                logger.warning(f"[api/views.py] 인증 실패: {username}")
                # 인증 실패 기록
                record_failed_login(request, username, "invalid_credentials")
                return Response(
                    {"error": "로그인 정보가 올바르지 않습니다."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            logger.warning(f"[api/views.py] 유효성 검사 실패: {serializer.errors}")
            # 유효성 검사 실패 기록
            record_failed_login(request, username, "validation_error")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"message": "로그아웃 되었습니다."}, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """비밀번호 변경 API"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """사용자 비밀번호 변경"""
        try:
            current_password = request.data.get("current_password")
            new_password = request.data.get("new_password")
            confirm_password = request.data.get("confirm_password")

            # 필수 데이터 검증
            if not all([current_password, new_password, confirm_password]):
                return Response(
                    {"error": "모든 필드를 입력해주세요."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 새 비밀번호 확인
            if new_password != confirm_password:
                return Response(
                    {"error": "새 비밀번호가 일치하지 않습니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 현재 비밀번호 확인
            if not request.user.check_password(current_password):
                return Response(
                    {"error": "현재 비밀번호가 올바르지 않습니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 새 비밀번호가 현재 비밀번호와 같은지 확인
            if current_password == new_password:
                return Response(
                    {"error": "새 비밀번호는 현재 비밀번호와 달라야 합니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 비밀번호 길이 검증 (최소 4자리)
            if len(new_password) < 4:
                return Response(
                    {"error": "비밀번호는 최소 4자리 이상이어야 합니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 비밀번호 변경
            request.user.set_password(new_password)
            request.user.save()

            logger.info(f"[api/views.py] 비밀번호 변경 성공: {request.user.username}")

            return Response(
                {"message": "비밀번호가 성공적으로 변경되었습니다."},
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[api/views.py] 비밀번호 변경 오류: {error_msg}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")

            return Response(
                {"error": f"비밀번호 변경 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


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
        student_serializer = UserSerializer(assigned_students, many=True)

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

            # 학생 데이터 로드 - User 모델에서 is_student=True이고 활성화된 사용자들
            students = User.objects.filter(is_student=True, is_active=True)
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

            # 모든 활성화된 학생 데이터 조회 (클리닉 관리를 위해) - User 모델 기반으로 변경
            students = User.objects.filter(is_student=True, is_active=True)
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


class ClinicAttendanceViewSet(viewsets.ModelViewSet):
    """클리닉 출석 관리 ViewSet"""

    queryset = ClinicAttendance.objects.all()
    serializer_class = ClinicAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """필터링된 queryset 반환"""
        queryset = super().get_queryset()

        # 활성화된 출석 데이터만 조회
        queryset = queryset.filter(is_active=True)

        # 클리닉 ID로 필터링
        clinic_id = self.request.query_params.get("clinic_id")
        if clinic_id:
            queryset = queryset.filter(clinic_id=clinic_id)

        # 날짜로 필터링 (개선된 로직)
        date = self.request.query_params.get("date")
        if date:
            try:
                from datetime import datetime

                filter_date = datetime.strptime(date, "%Y-%m-%d").date()
                # 특정 날짜에 해당하는 출석 데이터 조회
                # expected_clinic_date가 해당 날짜인 데이터를 우선 조회
                queryset = queryset.filter(expected_clinic_date=filter_date)
            except ValueError:
                pass  # 잘못된 날짜 형식이면 필터링하지 않음
        else:
            # 날짜 파라미터가 없는 경우, 오늘의 클리닉에 해당하는 데이터만 조회
            if clinic_id:
                try:
                    from datetime import datetime, timedelta

                    # 클리닉 정보 조회
                    from core.models import Clinic

                    clinic = Clinic.objects.get(id=clinic_id)

                    # 클리닉 요일을 숫자로 변환 (0=월요일, 6=일요일)
                    clinic_day_map = {
                        "mon": 0,
                        "tue": 1,
                        "wed": 2,
                        "thu": 3,
                        "fri": 4,
                        "sat": 5,
                        "sun": 6,
                    }

                    clinic_weekday = clinic_day_map.get(clinic.clinic_day, 0)
                    today = datetime.now().date()
                    today_weekday = today.weekday()

                    # 이번 주의 클리닉 날짜 계산
                    days_until_clinic = clinic_weekday - today_weekday

                    if days_until_clinic >= 0:
                        # 이번 주 클리닉 날짜 (오늘 포함)
                        expected_clinic_date = today + timedelta(days=days_until_clinic)
                    else:
                        # 다음 주 클리닉 날짜
                        expected_clinic_date = today + timedelta(
                            days=days_until_clinic + 7
                        )

                    # 해당 날짜의 클리닉 예약 데이터만 조회
                    queryset = queryset.filter(
                        expected_clinic_date=expected_clinic_date
                    )

                    logger.info(
                        f"[api/views.py] 출석 데이터 조회 - 클리닉 ID: {clinic_id}, "
                        f"오늘: {today}, 예상 클리닉 날짜: {expected_clinic_date}, "
                        f"필터링된 데이터: {queryset.count()}건"
                    )

                except Clinic.DoesNotExist:
                    logger.warning(
                        f"[api/views.py] 존재하지 않는 클리닉 ID: {clinic_id}"
                    )
                except Exception as e:
                    logger.error(f"[api/views.py] 출석 데이터 조회 오류: {str(e)}")

        return queryset.select_related("clinic", "student")

    @action(detail=True, methods=["patch"])
    def update_attendance(self, request, pk=None):
        """
        출석 상태 업데이트 (attended/absent/sick/late)
        """
        try:
            attendance = self.get_object()
            attendance_type = request.data.get("attendance_type")

            if attendance_type not in ["attended", "absent", "sick", "late", "none"]:
                return Response(
                    {"error": "유효하지 않은 출석 상태입니다."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 출석 상태 업데이트 시 actual_attendance_date를 오늘 날짜로 설정
            from django.utils import timezone

            today = timezone.now().date()

            attendance.attendance_type = attendance_type
            attendance.actual_attendance_date = (
                today  # 실제 출석 체크한 날짜로 업데이트
            )
            attendance.save()

            serializer = self.get_serializer(attendance)

            return Response(
                {
                    "message": "출석 상태가 업데이트되었습니다.",
                    "attendance": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"[api/views.py] update_attendance 오류: {str(e)}")
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
