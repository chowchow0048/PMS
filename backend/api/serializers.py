from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import Student, Subject, Clinic, StudentPlacement

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
    """사용자 직렬화"""

    # available_time_details = TimeSerializer(
    #     source="available_time", many=True, read_only=True
    # )  # 보충 시스템 개편으로 주석처리

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "user_name",
            "user_phone_num",
            "user_subject",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_teacher",
            "max_student_num",
            # "available_time",  # 보충 시스템 개편으로 주석처리
            # "available_time_details",  # 보충 시스템 개편으로 주석처리
        ]
        read_only_fields = ["id"]


class StudentSerializer(serializers.ModelSerializer):
    # assigned_teacher_name = serializers.CharField(
    #     source="assigned_teacher.user_name", read_only=True
    # )  # 보충 시스템 개편으로 주석처리
    subject_name = serializers.CharField(
        source="student_subject.subject", read_only=True
    )
    # available_time_details = TimeSerializer(
    #     source="available_time", many=True, read_only=True
    # )  # 보충 시스템 개편으로 주석처리

    class Meta:
        model = Student
        fields = [
            "id",
            "student_name",
            "student_phone_num",
            "student_parent_phone_num",
            "school",
            "grade",
            "student_subject",
            "subject_name",
            # "expected_teacher",  # 보충 시스템 개편으로 주석처리
            # "assigned_teacher",  # 보충 시스템 개편으로 주석처리
            # "assigned_teacher_name",  # 보충 시스템 개편으로 주석처리
            # "clinic_attended_dates",  # 보충 시스템 개편으로 주석처리
            # "available_time",  # 보충 시스템 개편으로 주석처리
            # "available_time_details",  # 보충 시스템 개편으로 주석처리
            "reserved_clinic",  # 보충 시스템 개편으로 새로 추가
        ]
        read_only_fields = ["id"]

    # 보충 시스템 개편으로 주석처리
    # def update(self, instance, validated_data):
    #     """출석 기록 업데이트 시 기존 기록에 추가하는 로직"""
    #     clinic_attended_dates = validated_data.get("clinic_attended_dates")
    #
    #     if clinic_attended_dates is not None:
    #         # 기존 출석 기록에 새로운 기록 추가
    #         existing_dates = instance.clinic_attended_dates or []
    #
    #         # 새로운 출석 기록을 기존 기록에 추가
    #         for new_record in clinic_attended_dates:
    #             # 중복 체크 (같은 날짜, 시간, 요일의 기록이 있는지 확인)
    #             is_duplicate = any(
    #                 existing_record.get("date") == new_record.get("date")
    #                 and existing_record.get("time") == new_record.get("time")
    #                 and existing_record.get("day") == new_record.get("day")
    #                 for existing_record in existing_dates
    #             )
    #
    #             if not is_duplicate:
    #                 existing_dates.append(new_record)
    #
    #         validated_data["clinic_attended_dates"] = existing_dates
    #
    #     return super().update(instance, validated_data)


class ClinicSerializer(serializers.ModelSerializer):
    # 선생님의 이름을 가져오는 필드
    # clinic_teacher 모델의 user_name 필드를 참조하여 읽기 전용으로 설정
    teacher_name = serializers.CharField(
        source="clinic_teacher.user_name", read_only=True
    )
    subject_name = serializers.CharField(
        source="clinic_subject.subject", read_only=True
    )
    day_display = serializers.CharField(
        source="get_clinic_day_display", read_only=True
    )  # 보충 시스템 개편으로 수정

    class Meta:
        model = Clinic
        fields = "__all__"


# 보충 시스템 개편으로 주석처리
# class CommentSerializer(serializers.ModelSerializer):
#     author_name = serializers.CharField(
#         source="comment_author.user_name", read_only=True
#     )
#     student_name = serializers.CharField(
#         source="comment_student.student_name", read_only=True
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
            "user_name",
            "email",
            "password",
            "password_confirm",
            "user_phone_num",
            "user_subject",
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
    class Meta:
        model = StudentPlacement
        fields = "__all__"


class StudentPlacementUpdateSerializer(serializers.Serializer):
    placements = serializers.ListField(
        child=serializers.DictField(child=serializers.IntegerField(), allow_empty=False)
    )
