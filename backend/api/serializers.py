from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import (
    # Student,  # Student 모델 삭제로 주석처리
    Subject,
    Clinic,
    StudentPlacement,
    WeeklyReservationPeriod,
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
        """클리닉 업데이트 시 clinic_students 필드 처리"""
        # clinic_students 데이터 추출
        clinic_students_data = validated_data.pop("clinic_students", None)

        # 다른 필드들 업데이트
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # clinic_students 업데이트
        if clinic_students_data is not None:
            if isinstance(clinic_students_data, list):
                # ID 배열인 경우
                if clinic_students_data and isinstance(clinic_students_data[0], int):
                    user_ids = clinic_students_data
                    users = User.objects.filter(id__in=user_ids)
                    instance.clinic_students.set(users)
                else:
                    # User 객체 배열인 경우 (보통은 이런 경우는 없음)
                    instance.clinic_students.set(clinic_students_data)

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
