from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import (
    # Student,  # Student 모델 삭제로 주석처리
    Subject,
    Clinic,
    StudentPlacement,
    WeeklyReservationPeriod,
    ClinicAttendance,
)

# from core.models import Time, Comment  # 보충 시스템 개편으로 주석처리
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = "__all__"


# 보충 시스템 개편으로 주석처리
# class TimeSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Time
#         fields = "__all__"
#
#     def to_representation(self, instance):
#         representation = super().to_representation(instance)
#         representation["time_day_display"] = instance.get_time_day_display()
#         representation["time_slot_formatted"] = instance.time_slot.strftime("%H:%M")
#         return representation


class UserSerializer(serializers.ModelSerializer):
    """사용자 직렬화 - 학생과 강사 정보 모두 포함"""

    # 과목명 표시용 필드 추가
    subject_name = serializers.CharField(source="subject.subject", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "name",  # user_name → name
            "phone_num",  # user_phone_num → phone_num
            "subject",  # user_subject → subject
            "subject_name",  # 과목명 표시용
            "is_active",
            "is_staff",
            "is_superuser",
            "is_teacher",
            "is_student",
            # 학생 전용 필드들
            "student_phone_num",
            "student_parent_phone_num",
            "school",
            "grade",
            "no_show",  # 무단결석 횟수
            "non_pass",  # 의무 클리닉 대상자 여부
            "essential_clinic",  # 필수 클리닉 신청 여부
        ]
        read_only_fields = ["id"]


# StudentSerializer 삭제 - User 모델로 통합됨
# class StudentSerializer(serializers.ModelSerializer):
#     # Student 모델이 삭제되었으므로 주석처리


class ClinicSerializer(serializers.ModelSerializer):
    # 선생님의 이름을 가져오는 필드 (필드명 변경: user_name → name)
    teacher_name = serializers.CharField(source="clinic_teacher.name", read_only=True)
    subject_name = serializers.CharField(
        source="clinic_subject.subject", read_only=True
    )
    day_display = serializers.CharField(source="get_clinic_day_display", read_only=True)

    # 클리닉 정보 추가 필드들
    current_students_count = serializers.SerializerMethodField()
    remaining_spots = serializers.SerializerMethodField()
    is_full = serializers.SerializerMethodField()

    # clinic_students 필드를 커스텀 처리 (유효성 검사 비활성화)
    clinic_students = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        write_only=True,
        help_text="사용자 ID 배열 (모든 사용자 유형 허용)",
    )

    class Meta:
        model = Clinic
        fields = "__all__"

    def get_current_students_count(self, obj):
        """현재 예약된 학생 수"""
        return obj.get_current_students_count()

    def get_remaining_spots(self, obj):
        """남은 자리 수"""
        return obj.get_remaining_spots()

    def get_is_full(self, obj):
        """정원이 찬 상태인지 확인"""
        return obj.is_full()

    def to_representation(self, instance):
        """출력 시 clinic_students를 User 객체로 직렬화"""
        representation = super().to_representation(instance)
        # clinic_students를 UserSerializer로 직렬화
        representation["clinic_students"] = UserSerializer(
            instance.clinic_students.all(), many=True
        ).data
        return representation

    def update(self, instance, validated_data):
        """클리닉 업데이트 시 clinic_students 필드 처리 및 의무 클리닉 상태 자동 업데이트"""
        # 로그 기록을 위해 미리 import
        import logging

        logger = logging.getLogger("api.clinic")

        # 디버깅용 로그
        logger.info(f"[ClinicSerializer] update 시작 - clinic_id={instance.id}")
        logger.info(
            f"[ClinicSerializer] validated_data keys: {list(validated_data.keys())}"
        )

        # clinic_students 데이터 추출
        clinic_students_data = validated_data.pop("clinic_students", None)
        logger.info(f"[ClinicSerializer] clinic_students_data: {clinic_students_data}")
        logger.info(
            f"[ClinicSerializer] clinic_students_data type: {type(clinic_students_data)}"
        )

        # clinic_students 데이터 유효성 검사
        if clinic_students_data is not None:
            if not isinstance(clinic_students_data, list):
                logger.error(
                    f"[ClinicSerializer] clinic_students는 리스트여야 합니다: {clinic_students_data}"
                )
                raise serializers.ValidationError(
                    {"clinic_students": "리스트 형태의 사용자 ID 배열이어야 합니다."}
                )

            # ListField(child=IntegerField())로 정의했으므로 항상 정수 배열로 들어옴
            logger.info(
                f"[ClinicSerializer] clinic_students_data 검증 완료: 정수 배열 {clinic_students_data}"
            )

        # 다른 필드들 업데이트
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # clinic_students 업데이트
        if clinic_students_data is not None:
            logger.info(f"[ClinicSerializer] clinic_students_data 처리 시작")
            if isinstance(clinic_students_data, list):
                logger.info(
                    f"[ClinicSerializer] clinic_students_data는 리스트: {clinic_students_data}"
                )
                # ListField(child=IntegerField())로 정의했으므로 항상 정수 배열
                user_ids = clinic_students_data
                logger.info(f"[ClinicSerializer] user_ids: {user_ids}")

                # 빈 배열 체크
                if len(user_ids) == 0:
                    logger.info(f"[ClinicSerializer] 빈 배열 - 모든 사용자 배치 해제")
                    users = User.objects.none()
                else:
                    # 모든 사용자 유형 허용 (학생, 강사, 관리자)
                    users = User.objects.filter(id__in=user_ids)
                    logger.info(f"[ClinicSerializer] 정수 배열 처리: {user_ids}")

                # 항상 처리 (빈 배열인 경우도 포함)
                user_count = users.count() if hasattr(users, "count") else len(users)
                logger.info(f"[ClinicSerializer] 찾은 사용자 수: {user_count}")

                # 존재하지 않는 사용자 ID들 확인 (빈 배열이 아닌 경우만)
                if user_ids:
                    if hasattr(users, "values_list"):
                        found_user_ids = set(users.values_list("id", flat=True))
                    else:
                        found_user_ids = set([user.id for user in users])
                    missing_user_ids = set(user_ids) - found_user_ids

                    if missing_user_ids:
                        missing_ids_list = list(missing_user_ids)
                        logger.error(
                            f"[ClinicSerializer] 존재하지 않는 사용자 ID들: {missing_ids_list}"
                        )
                        raise serializers.ValidationError(
                            {
                                "clinic_students": f"다음 사용자 ID들이 존재하지 않습니다: {missing_ids_list}"
                            }
                        )

                # 기존 사용자들 ID 조회
                existing_all_users = instance.clinic_students.all()
                existing_all_user_ids = set(
                    existing_all_users.values_list("id", flat=True)
                )

                logger.info(
                    f"[ClinicSerializer] 기존 사용자 ID들: {existing_all_user_ids}"
                )

                # 새로 추가된 사용자들과 제거된 사용자들 찾기
                new_user_ids = set(user_ids) - existing_all_user_ids
                removed_user_ids = existing_all_user_ids - set(user_ids)

                logger.info(
                    f"[ClinicSerializer] 새로 추가된 사용자 ID들: {new_user_ids}"
                )
                logger.info(
                    f"[ClinicSerializer] 제거된 사용자 ID들: {removed_user_ids}"
                )

                # 클리닉에 사용자 배치 (새로운 사용자 목록으로 완전 교체)
                final_users = User.objects.filter(id__in=user_ids)
                instance.clinic_students.set(final_users)
                logger.info(f"[ClinicSerializer] 클리닉에 사용자 배치 완료")

                # ClinicAttendance 모델 import
                from core.models import ClinicAttendance
                from datetime import datetime, timedelta

                # 클리닉 날짜 계산 (공통 로직)
                clinic_day_map = {
                    "mon": 0,
                    "tue": 1,
                    "wed": 2,
                    "thu": 3,
                    "fri": 4,
                    "sat": 5,
                    "sun": 6,
                }
                clinic_weekday = clinic_day_map.get(instance.clinic_day, 0)
                today = datetime.now().date()
                today_weekday = today.weekday()

                # 이번 주의 클리닉 날짜 계산
                days_until_clinic = clinic_weekday - today_weekday
                if days_until_clinic >= 0:
                    expected_clinic_date = today + timedelta(days=days_until_clinic)
                else:
                    expected_clinic_date = today + timedelta(days=days_until_clinic + 7)

                # 제거된 사용자들의 ClinicAttendance 삭제
                if removed_user_ids:
                    logger.info(
                        f"[ClinicSerializer] 제거된 사용자들의 ClinicAttendance 삭제 시작: {removed_user_ids}"
                    )

                    deleted_attendances = ClinicAttendance.objects.filter(
                        clinic=instance,
                        student_id__in=removed_user_ids,
                        expected_clinic_date=expected_clinic_date,
                    )
                    deleted_count = deleted_attendances.count()

                    if deleted_count > 0:
                        deleted_attendances.delete()
                        logger.info(
                            f"[ClinicSerializer] ClinicAttendance 삭제 완료: {deleted_count}건"
                        )
                    else:
                        logger.info(
                            f"[ClinicSerializer] 삭제할 ClinicAttendance가 없음"
                        )

                # 새로 추가된 사용자들 처리 (학생만 ClinicAttendance 생성)
                if new_user_ids:
                    logger.info(
                        f"[ClinicSerializer] 새로 추가된 사용자들 처리 시작: {new_user_ids}"
                    )

                    # 새로 추가된 사용자들 조회
                    newly_assigned_users = User.objects.filter(id__in=new_user_ids)
                    logger.info(
                        f"[ClinicSerializer] 새로 추가된 사용자 수: {newly_assigned_users.count()}"
                    )

                    for user in newly_assigned_users:
                        logger.info(
                            f"[ClinicSerializer] 사용자 처리 중 - user_id={user.id}, name={user.name}, is_student={user.is_student}"
                        )

                        # 학생인 경우에만 ClinicAttendance 생성
                        if user.is_student:
                            # ClinicAttendance 생성 또는 업데이트
                            attendance, created = (
                                ClinicAttendance.objects.get_or_create(
                                    clinic=instance,
                                    student=user,
                                    expected_clinic_date=expected_clinic_date,
                                    defaults={
                                        "is_active": True,
                                        "attendance_type": "none",
                                        "reservation_date": today,
                                    },
                                )
                            )

                            if created:
                                logger.info(
                                    f"[ClinicSerializer] ClinicAttendance 생성: attendance_id={attendance.id}"
                                )
                            else:
                                # 기존 attendance가 비활성화되어 있다면 활성화
                                if not attendance.is_active:
                                    attendance.is_active = True
                                    attendance.save(update_fields=["is_active"])
                                    logger.info(
                                        f"[ClinicSerializer] ClinicAttendance 활성화: attendance_id={attendance.id}"
                                    )

                            # 의무 클리닉 대상자인 경우 non_pass를 False로 변경
                            if user.non_pass:
                                logger.info(
                                    f"[ClinicSerializer] 처리 전 - user_id={user.id}, name={user.name}, non_pass={user.non_pass}"
                                )
                                user.non_pass = False
                                user.save(update_fields=["non_pass"])
                                logger.info(
                                    f"[ClinicSerializer] 처리 후 - user_id={user.id}, name={user.name}, non_pass={user.non_pass}"
                                )
                                logger.info(
                                    f"[ClinicSerializer] 의무 클리닉 상태 자동 해제: user_id={user.id}, name={user.name}, clinic_id={instance.id}"
                                )
                        else:
                            logger.info(
                                f"[ClinicSerializer] 비학생 사용자는 ClinicAttendance 생성 안함: user_id={user.id}, name={user.name}"
                            )
                else:
                    logger.info(f"[ClinicSerializer] 새로 추가된 사용자가 없음")
        else:
            logger.info(f"[ClinicSerializer] clinic_students_data가 None")

        logger.info(f"[ClinicSerializer] update 완료 - clinic_id={instance.id}")
        return instance


# 보충 시스템 개편으로 주석처리
# class CommentSerializer(serializers.ModelSerializer):
#     author_name = serializers.CharField(
#         source="comment_author.name", read_only=True  # user_name → name
#     )
#     student_name = serializers.CharField(
#         source="comment_student.name", read_only=True  # student_name → name
#     )
#
#     class Meta:
#         model = Comment
#         fields = "__all__"


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            "username",
            "name",  # user_name → name
            "email",
            "password",
            "password_confirm",
            "phone_num",  # user_phone_num → phone_num
            "subject",  # user_subject → subject
            "is_teacher",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password": "비밀번호가 일치하지 않습니다."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = User.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class StudentPlacementSerializer(serializers.ModelSerializer):
    # Student 모델 대신 User 모델 사용에 따른 필드명 변경
    student_name = serializers.CharField(source="student.name", read_only=True)
    teacher_name = serializers.CharField(source="teacher.name", read_only=True)
    subject_name = serializers.CharField(source="subject.subject", read_only=True)

    class Meta:
        model = StudentPlacement
        fields = "__all__"


class StudentPlacementUpdateSerializer(serializers.Serializer):
    placements = serializers.ListField(
        child=serializers.DictField(child=serializers.IntegerField(), allow_empty=False)
    )


class StudentUserGenerationSerializer(serializers.Serializer):
    """User 데이터를 기반으로 학생 사용자 아이디를 생성하는 serializer (Student 모델 삭제에 따른 수정)"""

    def generate_student_username(self, user):
        """
        8자리 학생 ID 생성 규칙:
        - 앞 2자리: 연도 (25 = 2025년)
        - 다음 2자리: 학교 코드 (01=세화고, 02=세화여고)
        - 다음 1자리: 학년 (1=1학년, 2=2학년, 3=3학년)
        - 마지막 3자리: 사용자 ID 순서 (001~999)
        """
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

        school_code = school_code_map.get(user.school, "99")
        grade_code = grade_code_map.get(user.grade, "9")

        # 사용자 ID를 3자리로 변환 (예: 1 -> 001)
        user_id_padded = str(user.id).zfill(3)

        # 8자리 ID 생성
        username = f"{current_year}{school_code}{grade_code}{user_id_padded}"

        return username

    def validate_and_create_users(self, users):
        """
        학생 사용자들의 username을 검증하고 업데이트
        Student 모델 삭제로 인해 User 모델 기반으로 변경
        """
        results = {
            "created_users": [],
            "duplicate_users": [],
            "error_users": [],
            "skipped_users": [],  # 이미 적절한 username이 있는 사용자들
        }

        for user in users:
            try:
                # is_student가 False인 사용자는 건너뛰기
                if not user.is_student:
                    results["skipped_users"].append(
                        {
                            "user_id": user.id,
                            "user_name": user.name,
                            "reason": "학생 사용자가 아닙니다.",
                        }
                    )
                    continue

                # 이미 적절한 username이 있는지 확인
                if (
                    user.username
                    and len(user.username) == 8
                    and user.username != user.name
                ):
                    results["skipped_users"].append(
                        {
                            "user_id": user.id,
                            "user_name": user.name,
                            "current_username": user.username,
                            "reason": "이미 8자리 사용자명이 설정되어 있습니다.",
                        }
                    )
                    continue

                # 8자리 사용자명 생성
                new_username = self.generate_student_username(user)

                # 중복 검사
                duplicate_check = self.check_duplicate_username(new_username, user.id)

                if duplicate_check["is_duplicate"]:
                    results["duplicate_users"].append(
                        {
                            "user_id": user.id,
                            "user_name": user.name,
                            "generated_username": new_username,
                            "existing_user_id": duplicate_check["existing_user_id"],
                            "duplicate_reason": duplicate_check["reason"],
                        }
                    )
                    continue

                # 사용자명 업데이트
                user.username = new_username
                user.save()

                results["created_users"].append(
                    {
                        "user_id": user.id,
                        "user_name": user.name,
                        "old_username": (
                            user.username if hasattr(user, "_old_username") else ""
                        ),
                        "new_username": new_username,
                    }
                )

            except Exception as e:
                results["error_users"].append(
                    {
                        "user_id": user.id,
                        "user_name": user.name,
                        "error": str(e),
                    }
                )

        return results

    def check_duplicate_username(self, username, current_user_id):
        """중복 사용자명 검사"""
        existing_user = (
            User.objects.filter(username=username).exclude(id=current_user_id).first()
        )
        if existing_user:
            return {
                "is_duplicate": True,
                "existing_user_id": existing_user.id,
                "reason": f"동일한 사용자명 '{username}'이 이미 존재함",
            }

        return {"is_duplicate": False}


class WeeklyReservationPeriodSerializer(serializers.ModelSerializer):
    """주간 예약 기간 직렬화"""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_reservation_open = serializers.SerializerMethodField()
    remaining_time = serializers.SerializerMethodField()

    class Meta:
        model = WeeklyReservationPeriod
        fields = [
            "id",
            "week_start_date",
            "week_end_date",
            "reservation_start",
            "reservation_end",
            "status",
            "status_display",
            "total_clinics",
            "total_reservations",
            "is_reservation_open",
            "remaining_time",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_is_reservation_open(self, obj):
        """현재 예약이 가능한 기간인지 확인"""
        return obj.is_reservation_open()

    def get_remaining_time(self, obj):
        """예약 마감까지 남은 시간"""
        return str(obj.get_remaining_time())


class ClinicAttendanceSerializer(serializers.ModelSerializer):
    """클리닉 출석 관리 시리얼라이저"""

    # 학생 이름과 클리닉 정보를 포함하여 표시
    student_name = serializers.CharField(source="student.name", read_only=True)
    clinic_info = serializers.CharField(source="clinic.__str__", read_only=True)
    attendance_type_display = serializers.CharField(
        source="get_attendance_type_display", read_only=True
    )

    class Meta:
        model = ClinicAttendance
        fields = [
            "id",
            "clinic",
            "student",
            "student_name",
            "clinic_info",
            "reservation_date",
            "expected_clinic_date",
            "actual_attendance_date",
            "attendance_type",
            "attendance_type_display",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "student_name",
            "clinic_info",
            "attendance_type_display",
            "reservation_date",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        """
        ClinicAttendance 생성 시 자동 날짜 설정은 모델의 save 메서드에서 처리됨
        """
        return super().create(validated_data)
