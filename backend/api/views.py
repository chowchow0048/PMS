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
    Time,
    Clinic,
    Comment,
    User,
    StudentPlacement,
)
from .serializers import (
    UserSerializer,
    StudentSerializer,
    SubjectSerializer,
    TimeSerializer,
    ClinicSerializer,
    CommentSerializer,
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

        # 특정 선생님에게 배정된 학생만 필터링
        teacher_id = self.request.query_params.get("teacher_id")
        if teacher_id is not None:
            queryset = queryset.filter(assigned_teacher_id=teacher_id)

        # 미배정 학생만 필터링
        unassigned = self.request.query_params.get("unassigned")
        if unassigned is not None and unassigned.lower() == "true":
            queryset = queryset.filter(assigned_teacher__isnull=True)

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
            logger.info(f"[api/views.py] 엑셀 파일 읽기 완료: {len(df)}행")

            # Google Form 스프레드시트 컬럼 확인
            # 컬럼 구조: A열(응답생성날짜), B열(학교), C열(학년), D열(이름), E열(학생전화번호), F열(학부모전화번호), G~R열(시간대), S열(희망선생)
            logger.info(f"[api/views.py] 엑셀 컬럼 목록: {list(df.columns)}")

            # 최소 필요 컬럼 수 확인 (A~F열, 최소 6개)
            if len(df.columns) < 6:
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

            # 각 행 처리
            for index, row in df.iterrows():
                try:
                    # Google Form 스프레드시트 컬럼 매핑
                    # A열: 응답생성날짜 (무시)
                    # B열: 학교
                    # C열: 학년
                    # D열: 이름
                    # E열: 학생 전화번호
                    # F열: 학부모 전화번호
                    # G~R열: 시간대 (10:00~21:00)
                    # S열: 희망 선생

                    columns = list(df.columns)
                    school = (
                        str(row[columns[1]]).strip() if len(columns) > 1 else ""
                    )  # B열
                    grade = (
                        str(row[columns[2]]).strip() if len(columns) > 2 else ""
                    )  # C열
                    name = (
                        str(row[columns[3]]).strip() if len(columns) > 3 else ""
                    )  # D열

                    # 전화번호 처리 - 앞의 0이 잘리는 문제 해결
                    student_phone_raw = row[columns[4]] if len(columns) > 4 else ""
                    if pd.isna(student_phone_raw):
                        student_phone = ""
                    else:
                        student_phone = (
                            str(int(student_phone_raw)).zfill(11)
                            if isinstance(student_phone_raw, (int, float))
                            else str(student_phone_raw).strip()
                        )
                        # 전화번호가 10자리나 11자리가 아니면 앞에 0 추가
                        if len(student_phone) == 10 and student_phone.startswith("1"):
                            student_phone = "0" + student_phone

                    parent_phone_raw = row[columns[5]] if len(columns) > 5 else ""
                    if pd.isna(parent_phone_raw):
                        parent_phone = ""
                    else:
                        parent_phone = (
                            str(int(parent_phone_raw)).zfill(11)
                            if isinstance(parent_phone_raw, (int, float))
                            else str(parent_phone_raw).strip()
                        )
                        # 전화번호가 10자리나 11자리가 아니면 앞에 0 추가
                        if len(parent_phone) == 10 and parent_phone.startswith("1"):
                            parent_phone = "0" + parent_phone

                    expected_teacher = (
                        str(row[columns[18]]).strip() if len(columns) > 18 else ""
                    )  # S열 (19번째)

                    # 빈 값 검증
                    if not all([school, grade, name, student_phone, parent_phone]):
                        results["error_students"].append(
                            {
                                "row": index + 2,  # 엑셀 행 번호 (헤더 포함)
                                "name": name,
                                "error": "필수 정보가 누락되었습니다.",
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
                    existing_student = Student.objects.filter(
                        school=school,
                        grade=grade,
                        student_name=name,
                        student_parent_phone_num=parent_phone,
                    ).first()

                    if existing_student:
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

                    # 가능한 시간대 정보 처리 (G~R열, 10:00~21:00)
                    available_times = []
                    time_columns = columns[
                        6:18
                    ]  # G열부터 R열까지 (6번째부터 17번째까지)

                    for col_idx, time_col in enumerate(time_columns):
                        if col_idx + 6 < len(columns):  # 컬럼이 존재하는지 확인
                            time_value = str(row[time_col]).strip()
                            if time_value and time_value.lower() not in [
                                "nan",
                                "none",
                                "",
                            ]:
                                # 시간은 10:00부터 21:00까지 (G열=10:00, H열=11:00, ..., R열=21:00)
                                hour = 10 + col_idx
                                time_slot = f"{hour:02d}:00"

                                # 요일 파싱 (예: "월, 화" -> ["월", "화"])
                                days = [day.strip() for day in time_value.split(",")]

                                for day in days:
                                    day_code = None
                                    if day in ["월", "월요일"]:
                                        day_code = "mon"
                                    elif day in ["화", "화요일"]:
                                        day_code = "tue"
                                    elif day in ["수", "수요일"]:
                                        day_code = "wed"
                                    elif day in ["목", "목요일"]:
                                        day_code = "thu"
                                    elif day in ["금", "금요일"]:
                                        day_code = "fri"
                                    elif day in ["토", "토요일"]:
                                        day_code = "sat"
                                    elif day in ["일", "일요일"]:
                                        day_code = "sun"

                                    if day_code:
                                        # Time 객체 생성 또는 조회
                                        time_obj, created = Time.objects.get_or_create(
                                            time_day=day_code, time_slot=time_slot
                                        )
                                        available_times.append(time_obj)

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

                    new_student = Student.objects.create(
                        student_name=name,
                        school=school,
                        grade=grade,
                        student_phone_num=student_phone,
                        student_parent_phone_num=parent_phone,
                        student_subject=default_subject,  # physics1 기본 과목 설정
                        expected_teacher=expected_teacher,  # 희망 선생 추가
                    )

                    # ManyToMany 관계 설정 (가능한 시간대들)
                    if available_times:
                        new_student.available_time.set(available_times)

                    results["added_students"].append(
                        {
                            "id": new_student.id,
                            "name": name,
                            "school": school,
                            "grade": grade,
                        }
                    )

                    logger.info(
                        f"[api/views.py] 새 학생 추가: {name} ({school} {grade})"
                    )

                except Exception as e:
                    logger.error(f"[api/views.py] 행 {index + 2} 처리 오류: {str(e)}")
                    results["error_students"].append(
                        {
                            "row": index + 2,
                            "name": name if "name" in locals() else "알 수 없음",
                            "error": str(e),
                        }
                    )

            # 임시 파일 삭제
            default_storage.delete(file_name)

            logger.info(
                f"[api/views.py] 엑셀 업로드 완료: 추가 {len(results['added_students'])}명, 중복 {len(results['duplicate_students'])}명, 오류 {len(results['error_students'])}명"
            )

            return Response(results, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"[api/views.py] 엑셀 파일 처리 오류: {str(e)}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")

            # 임시 파일 삭제 (오류 발생 시에도)
            try:
                if "file_name" in locals():
                    default_storage.delete(file_name)
            except:
                pass

            return Response(
                {"error": f"파일 처리 중 오류가 발생했습니다: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer


class TimeViewSet(viewsets.ModelViewSet):
    queryset = Time.objects.all()
    serializer_class = TimeSerializer


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

        return queryset


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer

    def get_queryset(self):
        """요청 파라미터에 따라 필터링된 코멘트 목록 반환"""
        queryset = Comment.objects.all()

        # 특정 학생의 코멘트만 필터링
        student_id = self.request.query_params.get("student_id")
        if student_id is not None:
            queryset = queryset.filter(comment_student_id=student_id)

        # 특정 작성자의 코멘트만 필터링
        author_id = self.request.query_params.get("author_id")
        if author_id is not None:
            queryset = queryset.filter(comment_author_id=author_id)

        return queryset


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
                    elif user.is_teacher:
                        # 강사는 마이페이지로
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

        # 배정된 학생 목록 조회
        assigned_students = Student.objects.filter(assigned_teacher=user)
        student_serializer = StudentSerializer(assigned_students, many=True)
        logger.info(f"[api/views.py] 배정된 학생 수: {assigned_students.count()}")

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


class TeacherAvailableTimeUpdateView(APIView):
    """선생님의 수업 가능 시간을 업데이트하는 뷰"""

    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, teacher_id):
        """
        선생님의 available_time을 업데이트하고 무결성 검사를 수행합니다.

        요청 본문:
        {
            "available_time_ids": [1, 2, 3, ...] // Time 모델의 ID 배열
        }

        응답:
        {
            "success": true,
            "affected_students": [
                {
                    "id": 1,
                    "student_name": "홍길동",
                    "school": "세화고",
                    "grade": "1학년"
                }
            ],
            "cancelled_clinics": [
                {
                    "id": 1,
                    "clinic_time": "월요일 10:00"
                }
            ]
        }
        """
        try:
            logger.info(
                f"[api/views.py] 선생님 시간표 업데이트 요청: teacher_id={teacher_id}"
            )

            # 선생님 조회
            try:
                teacher = User.objects.get(id=teacher_id, is_teacher=True)
            except User.DoesNotExist:
                logger.error(
                    f"[api/views.py] 선생님을 찾을 수 없음: teacher_id={teacher_id}"
                )
                return Response(
                    {"error": "해당 선생님을 찾을 수 없습니다."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # 권한 검사 (관리자 또는 슈퍼유저만 가능)
            if not (request.user.is_staff or request.user.is_superuser):
                logger.warning(
                    f"[api/views.py] 권한 없는 시간표 수정 시도: {request.user.username}"
                )
                return Response(
                    {"error": "시간표를 수정할 권한이 없습니다."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # 새로운 available_time_ids 가져오기
            available_time_ids = request.data.get("available_time_ids", [])
            logger.info(f"[api/views.py] 새로운 시간표 ID 목록: {available_time_ids}")

            # Time 객체들 조회
            new_available_times = Time.objects.filter(id__in=available_time_ids)
            logger.info(
                f"[api/views.py] 조회된 시간 객체 수: {new_available_times.count()}"
            )

            with transaction.atomic():
                # 기존 available_time 가져오기
                old_available_times = set(
                    teacher.available_time.values_list("id", flat=True)
                )
                new_available_time_set = set(available_time_ids)

                logger.info(f"[api/views.py] 기존 시간표: {old_available_times}")
                logger.info(f"[api/views.py] 새로운 시간표: {new_available_time_set}")

                # 무결성 검사: 영향받는 학생과 클리닉 찾기
                affected_students = []
                cancelled_clinics = []

                # 현재 이 선생님에게 배치된 학생들 조회
                assigned_students = Student.objects.filter(assigned_teacher=teacher)
                logger.info(
                    f"[api/views.py] 배치된 학생 수: {assigned_students.count()}"
                )

                for student in assigned_students:
                    # 학생의 available_time과 새로운 선생님 available_time의 교집합 확인
                    student_available_times = set(
                        student.available_time.values_list("id", flat=True)
                    )
                    common_times = student_available_times.intersection(
                        new_available_time_set
                    )

                    logger.info(
                        f"[api/views.py] 학생 {student.student_name}의 가능 시간: {student_available_times}"
                    )
                    logger.info(f"[api/views.py] 공통 시간: {common_times}")

                    # 공통 시간이 없으면 배치 해제 대상
                    if not common_times:
                        affected_students.append(
                            {
                                "id": student.id,
                                "student_name": student.student_name,
                                "school": student.school,
                                "grade": student.grade,
                            }
                        )

                        # 학생의 배치 해제
                        student.assigned_teacher = None
                        student.save()
                        logger.info(
                            f"[api/views.py] 학생 배치 해제: {student.student_name}"
                        )

                # 선생님과 관련된 클리닉 중 새로운 시간표에 없는 클리닉들 찾기
                teacher_clinics = Clinic.objects.filter(clinic_teacher=teacher)
                for clinic in teacher_clinics:
                    clinic_time_id = clinic.clinic_time.id
                    if clinic_time_id not in new_available_time_set:
                        cancelled_clinics.append(
                            {"id": clinic.id, "clinic_time": str(clinic.clinic_time)}
                        )

                        # 클리닉 삭제
                        clinic.delete()
                        logger.info(f"[api/views.py] 클리닉 취소: {clinic.clinic_time}")

                # 선생님의 available_time 업데이트
                teacher.available_time.set(new_available_times)
                logger.info(f"[api/views.py] 선생님 시간표 업데이트 완료")

                return Response(
                    {
                        "success": True,
                        "affected_students": affected_students,
                        "cancelled_clinics": cancelled_clinics,
                    }
                )

        except Exception as e:
            logger.error(f"[api/views.py] 시간표 업데이트 오류: {str(e)}")
            logger.error(f"[api/views.py] 스택 트레이스:\n{traceback.format_exc()}")
            return Response(
                {"error": f"시간표 업데이트 중 오류가 발생했습니다: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
