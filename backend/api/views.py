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
    Student,
    Subject,
    # Time,  # 보충 시스템 개편으로 주석처리
    Clinic,
    # Comment,  # 보충 시스템 개편으로 주석처리
    User,
    StudentPlacement,
)
from .serializers import (
    UserSerializer,
    StudentSerializer,
    SubjectSerializer,
    # TimeSerializer,  # 보충 시스템 개편으로 주석처리
    ClinicSerializer,
    # CommentSerializer,  # 보충 시스템 개편으로 주석처리
    UserRegistrationSerializer,
    LoginSerializer,
    StudentPlacementSerializer,
    StudentPlacementUpdateSerializer,
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

# 로거 설정
logger = logging.getLogger("api.auth")
mypage_logger = logging.getLogger("mypage")

# Create your views here.


class UserViewSet(viewsets.ModelViewSet):
    """사용자 뷰셋 - 읽기 전용"""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """요청 파라미터에 따라 필터링된 사용자 목록 반환"""
        queryset = User.objects.all()

        # 활성화된 사용자만 필터링
        is_activated = self.request.query_params.get("is_activated")
        if is_activated is not None:
            queryset = queryset.filter(is_activated=(is_activated.lower() == "true"))

        # 관리자만 필터링
        is_manager = self.request.query_params.get("is_manager")
        if is_manager is not None:
            queryset = queryset.filter(is_manager=(is_manager.lower() == "true"))

        # 활성 상태 필터링
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=(is_active.lower() == "true"))

        logger.info(f"[api/views.py] 사용자 조회 결과: {queryset.count()} 명")

        return queryset


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """요청 파라미터에 따라 필터링된 학생 목록 반환"""
        queryset = Student.objects.all()

        # 보충 시스템 개편으로 주석처리 - 더 이상 teacher 배정 개념 없음
        # # 특정 선생님에게 배정된 학생만 필터링
        # teacher_id = self.request.query_params.get("teacher_id")
        # if teacher_id is not None:
        #     queryset = queryset.filter(assigned_teacher_id=teacher_id)
        #
        # # 미배정 학생만 필터링
        # unassigned = self.request.query_params.get("unassigned")
        # if unassigned is not None and unassigned.lower() == "true":
        #     queryset = queryset.filter(assigned_teacher__isnull=True)

        return queryset

    def update(self, request, *args, **kwargs):
        """학생 정보 업데이트 (부분 업데이트 허용)"""
        logger.info(f"[api/views.py] 학생 정보 업데이트 요청: {request.data}")

        # 부분 업데이트 허용
        partial = kwargs.pop("partial", True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        logger.info(f"[api/views.py] 학생 정보 업데이트 성공: {instance.id}")
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def upload_excel(self, request):
        """Google Form 스프레드시트에서 생성된 엑셀 파일로 학생 명단 업로드"""
        logger.info("[api/views.py] 엑셀 파일 업로드 시작")
        # print("🔍 [DEBUG] 엑셀 파일 업로드 시작")

        if "file" not in request.FILES:
            # print("❌ [DEBUG] 파일이 업로드되지 않았습니다.")
            return Response(
                {"error": "파일이 업로드되지 않았습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        excel_file = request.FILES["file"]
        # print(f"🔍 [DEBUG] 업로드된 파일: {excel_file.name}")
        # print(f"🔍 [DEBUG] 파일 크기: {excel_file.size} bytes")
        # print(f"🔍 [DEBUG] 파일 타입: {excel_file.content_type}")

        # 파일 확장자 검증
        if not excel_file.name.endswith((".xlsx", ".xls")):
            # print(f"❌ [DEBUG] 잘못된 파일 확장자: {excel_file.name}")
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
            # print(f"🔍 [DEBUG] 임시 파일 저장 경로: {file_path}")

            # 엑셀 파일 읽기
            # print("🔍 [DEBUG] 엑셀 파일 읽기 시도...")
            df = pd.read_excel(file_path)
            # print(f"🔍 [DEBUG] 엑셀 파일 읽기 완료: {len(df)}행")
            # print(f"🔍 [DEBUG] 컬럼 목록: {list(df.columns)}")
            # print(f"🔍 [DEBUG] 데이터 샘플 (첫 3행):\n{df.head(3)}")

            logger.info(f"[api/views.py] 엑셀 파일 읽기 완료: {len(df)}행")

            # Google Form 스프레드시트 컬럼 확인
            # 컬럼 구조: A열(응답생성날짜), B열(학교), C열(학년), D열(이름), E열(학생전화번호), F열(학부모전화번호), G~R열(시간대), S열(희망선생)
            logger.info(f"[api/views.py] 엑셀 컬럼 목록: {list(df.columns)}")

            # 최소 필요 컬럼 수 확인 (A~F열, 최소 6개)
            if len(df.columns) < 6:
                # print(f"❌ [DEBUG] 컬럼 수 부족: {len(df.columns)}개 (최소 6개 필요)")
                default_storage.delete(file_name)
                return Response(
                    {
                        "error": "Google Form 스프레드시트 형식이 아닙니다. 최소 6개 컬럼이 필요합니다."
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

            # print(f"🔍 [DEBUG] 데이터 처리 시작: {len(df)}행")

            # 각 행 처리
            for index, row in df.iterrows():
                # print(f"🔍 [DEBUG] 행 {index + 2} 처리 중...")
                try:
                    # 컬럼 순서 기반으로 데이터 추출
                    # 0: 응답생성날짜, 1: 학교, 2: 학년, 3: 이름, 4: 학생전화번호, 5: 학부모전화번호
                    timestamp = str(row.iloc[0]).strip() if len(row) > 0 else ""
                    school = str(row.iloc[1]).strip() if len(row) > 1 else ""
                    grade = str(row.iloc[2]).strip() if len(row) > 2 else ""
                    name = str(row.iloc[3]).strip() if len(row) > 3 else ""

                    # 전화번호 처리 - 앞의 0이 잘리는 문제 해결
                    student_phone_raw = row.iloc[4] if len(row) > 4 else ""
                    if pd.isna(student_phone_raw):
                        student_phone = ""
                    else:
                        if isinstance(student_phone_raw, (int, float)):
                            # 숫자형인 경우 문자열로 변환하고 앞에 0 추가
                            student_phone = str(int(student_phone_raw)).zfill(11)
                        else:
                            student_phone = str(student_phone_raw).strip()

                        # 전화번호가 10자리이고 1로 시작하면 앞에 0 추가
                        if len(student_phone) == 10 and student_phone.startswith("1"):
                            student_phone = "0" + student_phone

                    parent_phone_raw = row.iloc[5] if len(row) > 5 else ""
                    if pd.isna(parent_phone_raw):
                        parent_phone = ""
                    else:
                        if isinstance(parent_phone_raw, (int, float)):
                            # 숫자형인 경우 문자열로 변환하고 앞에 0 추가
                            parent_phone = str(int(parent_phone_raw)).zfill(11)
                        else:
                            parent_phone = str(parent_phone_raw).strip()

                        # 전화번호가 10자리이고 1로 시작하면 앞에 0 추가
                        if len(parent_phone) == 10 and parent_phone.startswith("1"):
                            parent_phone = "0" + parent_phone

                    # print(
                    #     f"🔍 [DEBUG] 행 {index + 2}: 학생명={name}, 학교={school}, 학년={grade}"
                    # )
                    # print(
                    #     f"🔍 [DEBUG] 행 {index + 2}: 학생번호={student_phone}, 학부모번호={parent_phone}"
                    # )

                    # 빈 값 검증
                    if not all([school, grade, name, student_phone, parent_phone]):
                        # print(f"❌ [DEBUG] 행 {index + 2}: 필수 정보 누락")
                        results["error_students"].append(
                            {
                                "row": index + 2,  # 엑셀 행 번호 (헤더 포함)
                                "name": name,
                                "error": "필수 정보가 누락되었습니다.",
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
                        # print(
                        #     f"❌ [DEBUG] 행 {index + 2}: 지원하지 않는 학교 '{original_school}'"
                        # )
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": f"지원하지 않는 학교입니다: {school}",
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
                        # print(
                        #     f"❌ [DEBUG] 행 {index + 2}: 지원하지 않는 학년 '{original_grade}'"
                        # )
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "error": f"지원하지 않는 학년입니다: {grade}",
                            }
                        )
                        continue

                    # print(
                    #     f"🔍 [DEBUG] 행 {index + 2}: 정규화 완료 - 학교={school}, 학년={grade}"
                    # )

                    # 중복 검사 (학교, 학년, 이름, 학부모번호로 확인)
                    existing_student = Student.objects.filter(
                        school=school,
                        grade=grade,
                        student_name=name,
                        student_parent_phone_num=parent_phone,
                    ).first()

                    if existing_student:
                        # print(
                        #     f"⚠️ [DEBUG] 행 {index + 2}: 중복 학생 발견 (ID: {existing_student.id})"
                        # )
                        results["duplicate_students"].append(
                            {
                                "row": index + 2,
                                "name": name,
                                "school": school,
                                "grade": grade,
                                "existing_id": existing_student.id,
                            }
                        )
                        continue

                    # 새 학생 생성
                    # 기본 과목을 physics1으로 설정
                    default_subject = None
                    try:
                        # physics1 과목을 기본값으로 우선 설정
                        default_subject = Subject.objects.filter(
                            subject="physics1"
                        ).first()
                        if not default_subject:
                            # physics1이 없으면 첫 번째 과목 사용
                            default_subject = Subject.objects.first()
                    except Subject.DoesNotExist:
                        pass

                    # print(f"🔍 [DEBUG] 행 {index + 2}: 새 학생 생성 시도...")
                    new_student = Student.objects.create(
                        student_name=name,
                        school=school,
                        grade=grade,
                        student_phone_num=student_phone,
                        student_parent_phone_num=parent_phone,
                        student_subject=default_subject,  # physics1 기본 과목 설정
                    )

                    results["added_students"].append(
                        {
                            "id": new_student.id,
                            "name": name,
                            "school": school,
                            "grade": grade,
                        }
                    )

                    # print(
                    #     f"✅ [DEBUG] 행 {index + 2}: 새 학생 추가 완료 (ID: {new_student.id})"
                    # )
                    logger.info(
                        f"[api/views.py] 새 학생 추가: {name} ({school} {grade})"
                    )

                except Exception as e:
                    error_msg = str(e)
                    # print(f"❌ [DEBUG] 행 {index + 2} 처리 오류: {error_msg}")
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
            # print("🔍 [DEBUG] 임시 파일 삭제 완료")

            # print(
            #     f"✅ [DEBUG] 처리 완료 - 추가: {len(results['added_students'])}명, 중복: {len(results['duplicate_students'])}명, 오류: {len(results['error_students'])}명"
            # )

            logger.info(
                f"[api/views.py] 엑셀 업로드 완료: 추가 {len(results['added_students'])}명, 중복 {len(results['duplicate_students'])}명, 오류 {len(results['error_students'])}명"
            )

            return Response(results, status=status.HTTP_200_OK)

        except Exception as e:
            error_msg = str(e)
            # print(f"❌ [DEBUG] 엑셀 파일 처리 중 전체 오류: {error_msg}")
            logger.error(f"[api/views.py] 엑셀 파일 처리 오류: {error_msg}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")

            # 임시 파일 삭제 (오류 발생 시에도)
            try:
                if "file_name" in locals():
                    default_storage.delete(file_name)
                    # print("🔍 [DEBUG] 오류 발생 시 임시 파일 삭제 완료")
            except:
                pass

            return Response(
                {"error": f"파일 처리 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer


# 보충 시스템 개편으로 주석처리
# class TimeViewSet(viewsets.ModelViewSet):
#     queryset = Time.objects.all()
#     serializer_class = TimeSerializer


class ClinicViewSet(viewsets.ModelViewSet):
    queryset = Clinic.objects.all()
    serializer_class = ClinicSerializer

    def get_queryset(self):
        """요청 파라미터에 따라 필터링된 클리닉 목록 반환"""
        queryset = Clinic.objects.all()

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
    def upload_clinic_enrollment(self, request):
        """보충 신청 엑셀 파일로 클리닉 등록 처리"""
        logger.info("[api/views.py] 보충 신청 엑셀 파일 업로드 시작")
        # print("🔍 [DEBUG] 보충 신청 엑셀 파일 업로드 시작")

        if "file" not in request.FILES:
            # print("❌ [DEBUG] 파일이 업로드되지 않았습니다.")
            return Response(
                {"error": "파일이 업로드되지 않았습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        excel_file = request.FILES["file"]
        # print(f"🔍 [DEBUG] 업로드된 파일: {excel_file.name}")
        # print(f"🔍 [DEBUG] 파일 크기: {excel_file.size} bytes")
        # print(f"🔍 [DEBUG] 파일 타입: {excel_file.content_type}")

        # 파일 확장자 검증
        if not excel_file.name.endswith((".xlsx", ".xls")):
            # print(f"❌ [DEBUG] 잘못된 파일 확장자: {excel_file.name}")
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
            # print(f"🔍 [DEBUG] 임시 파일 저장 경로: {file_path}")

            # 엑셀 파일 읽기
            # print("🔍 [DEBUG] 보충 신청 엑셀 파일 읽기 시도...")
            df = pd.read_excel(file_path)
            # print(f"🔍 [DEBUG] 보충 신청 엑셀 파일 읽기 완료: {len(df)}행")
            # print(f"🔍 [DEBUG] 컬럼 목록: {list(df.columns)}")
            # print(f"🔍 [DEBUG] 데이터 샘플 (첫 3행):\n{df.head(3)}")

            logger.info(f"[api/views.py] 보충 신청 엑셀 파일 읽기 완료: {len(df)}행")

            # 컬럼 구조 확인 (총 5개 컬럼 필요)
            if len(df.columns) < 5:
                # print(f"❌ [DEBUG] 컬럼 수 부족: {len(df.columns)}개 (5개 필요)")
                default_storage.delete(file_name)
                return Response(
                    {
                        "error": "보충 신청 양식이 올바르지 않습니다. 5개 컬럼이 필요합니다."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 요일 매핑 딕셔너리
            day_mapping = {
                "월": "mon",
                "월요일": "mon",
                "화": "tue",
                "화요일": "tue",
                "수": "wed",
                "수요일": "wed",
                "목": "thu",
                "목요일": "thu",
                "금": "fri",
                "금요일": "fri",
            }
            # print(f"🔍 [DEBUG] 요일 매핑 딕셔너리: {day_mapping}")

            # 기존 클리닉 정보 확인
            existing_clinics = Clinic.objects.all()
            # print(f"🔍 [DEBUG] 기존 클리닉 수: {existing_clinics.count()}개")
            for clinic in existing_clinics:
                # print(
                #     f"🔍 [DEBUG] 클리닉: {clinic.clinic_day} - {clinic.clinic_teacher.user_name}"
                # )
                pass

            # 데이터 처리 결과 저장
            results = {
                "total_rows": len(df),
                "processed_students": [],
                "not_found_students": [],
                "error_students": [],
            }

            # print(f"🔍 [DEBUG] 보충 신청 데이터 처리 시작: {len(df)}행")

            # 각 행 처리
            for index, row in df.iterrows():
                # print(f"🔍 [DEBUG] 행 {index + 2} 처리 중...")
                try:
                    # 컬럼 순서 기반으로 데이터 추출
                    # 0: 타임스탬프, 1: 학생이름, 2: 학생핸드폰번호, 3: 숙제해설요일, 4: 자유질문요일
                    timestamp = str(row.iloc[0]).strip() if len(row) > 0 else ""
                    student_name = str(row.iloc[1]).strip() if len(row) > 1 else ""
                    student_phone_raw = row.iloc[2] if len(row) > 2 else ""
                    prime_days_text = str(row.iloc[3]).strip() if len(row) > 3 else ""
                    sub_days_text = str(row.iloc[4]).strip() if len(row) > 4 else ""

                    # 전화번호 처리 (앞의 0이 잘리는 문제 해결)
                    if pd.isna(student_phone_raw):
                        student_phone = ""
                    else:
                        if isinstance(student_phone_raw, (int, float)):
                            # 숫자형인 경우 문자열로 변환하고 앞에 0 추가
                            student_phone = str(int(student_phone_raw)).zfill(11)
                        else:
                            student_phone = str(student_phone_raw).strip()

                        # 전화번호가 10자리이고 1로 시작하면 앞에 0 추가
                        if len(student_phone) == 10 and student_phone.startswith("1"):
                            student_phone = "0" + student_phone

                    # print(
                    #     f"🔍 [DEBUG] 행 {index + 2}: 학생명={student_name}, 전화번호={student_phone}"
                    # )
                    # print(
                    #     f"🔍 [DEBUG] 행 {index + 2}: 숙제해설={prime_days_text}, 자유질문={sub_days_text}"
                    # )

                    # 빈 값 검증
                    if not all([student_name, student_phone]):
                        # print(
                        #     f"❌ [DEBUG] 행 {index + 2}: 학생 이름 또는 전화번호 누락"
                        # )
                        results["error_students"].append(
                            {
                                "row": index + 2,
                                "name": student_name,
                                "error": "학생 이름 또는 전화번호가 누락되었습니다.",
                            }
                        )
                        continue

                    # 학생 찾기 (이름과 전화번호로 매칭)
                    # print(f"🔍 [DEBUG] 행 {index + 2}: 학생 검색 시도...")
                    student = Student.objects.filter(
                        student_name=student_name, student_phone_num=student_phone
                    ).first()

                    if not student:
                        # print(f"❌ [DEBUG] 행 {index + 2}: 학생을 찾을 수 없음")
                        # 전체 학생 목록에서 이름으로라도 찾아보기
                        similar_students = Student.objects.filter(
                            student_name=student_name
                        )
                        # print(
                        #     f"🔍 [DEBUG] 행 {index + 2}: 동일 이름 학생 수: {similar_students.count()}명"
                        # )
                        for s in similar_students:
                            # print(
                            #     f"🔍 [DEBUG] 행 {index + 2}: 동일 이름 학생 - {s.student_name} ({s.student_phone_num})"
                            # )
                            pass

                        results["not_found_students"].append(
                            {
                                "row": index + 2,
                                "name": student_name,
                                "phone": student_phone,
                            }
                        )
                        continue

                    # print(f"✅ [DEBUG] 행 {index + 2}: 학생 발견 (ID: {student.id})")

                    # 숙제 해설 요일 파싱 및 처리
                    prime_enrollments = []
                    if prime_days_text and prime_days_text.lower() not in [
                        "nan",
                        "none",
                        "",
                    ]:
                        # print(
                        #     f"🔍 [DEBUG] 행 {index + 2}: 숙제해설 요일 파싱 - '{prime_days_text}'"
                        # )
                        prime_days = [
                            day.strip()
                            for day in prime_days_text.replace(" ", "").split(",")
                        ]
                        # print(
                        #     f"🔍 [DEBUG] 행 {index + 2}: 파싱된 숙제해설 요일: {prime_days}"
                        # )

                        for day_kr in prime_days:
                            if day_kr in day_mapping:
                                day_en = day_mapping[day_kr]
                                # print(
                                #     f"🔍 [DEBUG] 행 {index + 2}: {day_kr} -> {day_en} 클리닉 검색..."
                                # )
                                clinic = Clinic.objects.filter(
                                    clinic_day=day_en
                                ).first()
                                if clinic:
                                    # ManyToMany 관계에서 학생 추가
                                    clinic.clinic_prime_students.add(student)
                                    prime_enrollments.append(f"{day_kr}(숙제해설)")
                                    # print(
                                    #     f"✅ [DEBUG] 행 {index + 2}: {day_kr} 숙제해설 클리닉 등록 완료"
                                    # )
                                    logger.info(
                                        f"[api/views.py] {student_name} -> {day_kr} 숙제해설 클리닉 등록"
                                    )
                                else:
                                    # print(
                                    #     f"❌ [DEBUG] 행 {index + 2}: {day_kr}({day_en}) 클리닉을 찾을 수 없음"
                                    # )
                                    pass
                            else:
                                # print(
                                #     f"❌ [DEBUG] 행 {index + 2}: 매핑되지 않는 요일 '{day_kr}'"
                                # )
                                pass

                    # 자유 질문 요일 파싱 및 처리
                    sub_enrollments = []
                    if sub_days_text and sub_days_text.lower() not in [
                        "nan",
                        "none",
                        "",
                    ]:
                        # print(
                        #     f"🔍 [DEBUG] 행 {index + 2}: 자유질문 요일 파싱 - '{sub_days_text}'"
                        # )
                        sub_days = [
                            day.strip()
                            for day in sub_days_text.replace(" ", "").split(",")
                        ]
                        # print(
                        #     f"🔍 [DEBUG] 행 {index + 2}: 파싱된 자유질문 요일: {sub_days}"
                        # )

                        for day_kr in sub_days:
                            if day_kr in day_mapping:
                                day_en = day_mapping[day_kr]
                                # print(
                                #     f"🔍 [DEBUG] 행 {index + 2}: {day_kr} -> {day_en} 클리닉 검색..."
                                # )
                                clinic = Clinic.objects.filter(
                                    clinic_day=day_en
                                ).first()
                                if clinic:
                                    # ManyToMany 관계에서 학생 추가
                                    clinic.clinic_sub_students.add(student)
                                    sub_enrollments.append(f"{day_kr}(자유질문)")
                                    # print(
                                    #     f"✅ [DEBUG] 행 {index + 2}: {day_kr} 자유질문 클리닉 등록 완료"
                                    # )
                                    logger.info(
                                        f"[api/views.py] {student_name} -> {day_kr} 자유질문 클리닉 등록"
                                    )
                                else:
                                    # print(
                                    #     f"❌ [DEBUG] 행 {index + 2}: {day_kr}({day_en}) 클리닉을 찾을 수 없음"
                                    # )
                                    pass
                            else:
                                # print(
                                #     f"❌ [DEBUG] 행 {index + 2}: 매핑되지 않는 요일 '{day_kr}'"
                                # )
                                pass

                    results["processed_students"].append(
                        {
                            "id": student.id,
                            "name": student_name,
                            "phone": student_phone,
                            "prime_enrollments": prime_enrollments,
                            "sub_enrollments": sub_enrollments,
                        }
                    )

                    # print(f"✅ [DEBUG] 행 {index + 2}: 보충 신청 처리 완료")
                    logger.info(f"[api/views.py] 보충 신청 처리 완료: {student_name}")

                except Exception as e:
                    error_msg = str(e)
                    # print(f"❌ [DEBUG] 행 {index + 2} 처리 오류: {error_msg}")
                    logger.error(
                        f"[api/views.py] 행 {index + 2} 처리 오류: {error_msg}"
                    )
                    results["error_students"].append(
                        {
                            "row": index + 2,
                            "name": (
                                student_name
                                if "student_name" in locals()
                                else "알 수 없음"
                            ),
                            "error": error_msg,
                        }
                    )

            # 임시 파일 삭제
            default_storage.delete(file_name)
            # print("🔍 [DEBUG] 임시 파일 삭제 완료")

            # print(
            #     f"✅ [DEBUG] 보충 신청 처리 완료 - 처리: {len(results['processed_students'])}명, 미발견: {len(results['not_found_students'])}명, 오류: {len(results['error_students'])}명"
            # )

            logger.info(
                f"[api/views.py] 보충 신청 엑셀 업로드 완료: 처리 {len(results['processed_students'])}명, "
                f"미발견 {len(results['not_found_students'])}명, 오류 {len(results['error_students'])}명"
            )

            return Response(results, status=status.HTTP_200_OK)

        except Exception as e:
            error_msg = str(e)
            # print(f"❌ [DEBUG] 보충 신청 엑셀 파일 처리 중 전체 오류: {error_msg}")
            logger.error(f"[api/views.py] 보충 신청 엑셀 파일 처리 오류: {error_msg}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")

            # 임시 파일 삭제 (오류 발생 시에도)
            try:
                if "file_name" in locals():
                    default_storage.delete(file_name)
                    # print("🔍 [DEBUG] 오류 발생 시 임시 파일 삭제 완료")
            except:
                pass

            return Response(
                {"error": f"파일 처리 중 오류가 발생했습니다: {error_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# 보충 시스템 개편으로 주석처리
# class CommentViewSet(viewsets.ModelViewSet):
#     queryset = Comment.objects.all()
#     serializer_class = CommentSerializer
#
#     def get_queryset(self):
#         """요청 파라미터에 따라 필터링된 코멘트 목록 반환"""
#         queryset = Comment.objects.all()
#
#         # 특정 학생의 코멘트만 필터링
#         student_id = self.request.query_params.get("student_id")
#         if student_id is not None:
#             queryset = queryset.filter(comment_student_id=student_id)
#
#         # 특정 작성자의 코멘트만 필터링
#         author_id = self.request.query_params.get("author_id")
#         if author_id is not None:
#             queryset = queryset.filter(comment_author_id=author_id)
#
#         return queryset


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
                    elif user.is_staff and not user.is_superuser:
                        # 관리자는 학생 배치 페이지로
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

            # 학생 데이터 로드
            students = Student.objects.all()
            logger.info(f"[api/views.py] 학생 데이터 로드 완료: {students.count()}명")

            # 학생 데이터 직렬화
            student_serializer = StudentSerializer(students, many=True)
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

            # 모든 학생 데이터 조회 (클리닉 관리를 위해)
            students = Student.objects.all()
            student_serializer = StudentSerializer(students, many=True)

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
        response_data = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "environment": "production" if not settings.DEBUG else "development",
            "message": "Application is running",
            "database": "checking...",
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
            logger.info("[api/views.py] 헬스체크 성공 - 기본 상태 확인")
            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            error_msg = str(e)
            print(f"❌ [HEALTH] 헬스체크 실패: {error_msg}")

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
