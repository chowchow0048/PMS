from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from .models import Student, Subject, Time, Clinic, Comment
import datetime
from django import forms

User = get_user_model()


# Time 관리자 설정
class TimeAdmin(admin.ModelAdmin):
    list_display = ("time_day", "time_slot_formatted")
    list_filter = ("time_day",)
    search_fields = ("time_day",)
    actions = ["create_timeslots_for_all_days"]

    def time_slot_formatted(self, obj):
        return obj.time_slot.strftime("%H:%M")

    time_slot_formatted.short_description = "시간"

    def create_timeslots_for_all_days(self, request, queryset):
        """
        모든 요일(월~일)에 대해 08:00부터 22:00까지 시간 슬롯을 생성하는 액션
        이미 존재하는 시간 슬롯은 중복 생성하지 않음
        """
        days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        count = 0

        for day in days:
            # 08:00부터 22:00까지 (22:00 포함하지 않음, 즉 21:00까지)
            for hour in range(8, 22):
                time_obj = datetime.time(hour=hour, minute=0)
                # 이미 존재하는지 확인하여 중복 생성 방지
                if not Time.objects.filter(time_day=day, time_slot=time_obj).exists():
                    Time.objects.create(time_day=day, time_slot=time_obj)
                    count += 1

        self.message_user(request, f"{count}개의 시간 슬롯이 생성되었습니다.")

    create_timeslots_for_all_days.short_description = (
        "모든 요일에 08:00~21:00 시간 슬롯 생성"
    )


# User 관리자 설정
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = (
        "id",
        "username",
        "user_name",
        "is_teacher",
        "is_staff",
        "is_superuser",
    )
    list_filter = ("is_teacher", "is_staff", "is_superuser")
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (
            "개인정보",
            {
                "fields": (
                    "user_name",
                    "user_phone_num",
                    "user_subject",
                    "max_student_num",
                )
            },
        ),
        ("수업 가능 시간", {"fields": ("available_time",)}),
        ("권한", {"fields": ("is_teacher", "is_staff", "is_superuser", "is_active")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "user_name",
                    "password1",
                    "password2",
                    "is_teacher",
                    "is_staff",
                    "is_superuser",
                    "is_active",
                ),
            },
        ),
    )
    filter_horizontal = (
        "available_time",
    )  # ManyToManyField를 위한 filter_horizontal 추가
    search_fields = ("username", "user_name")
    ordering = ("username",)


# Student 관리자 설정
class StudentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student_name",
        "school",
        "grade",
        "student_phone_num",
        "student_parent_phone_num",
        "get_subject",
        "get_teacher",
    )
    fieldsets = (
        (
            "개인 정보",
            {
                "fields": (
                    "student_name",
                    "school",
                    "grade",
                    "student_phone_num",
                    "student_parent_phone_num",
                    "student_subject",
                    "expected_teacher",
                    "assigned_teacher",
                )
            },
        ),
        (
            "수업 가능 시간",
            {"fields": ("available_time",)},
        ),
    )
    filter_horizontal = (
        "available_time",
    )  # ManyToManyField를 위한 filter_horizontal 추가
    list_filter = ("student_subject", "assigned_teacher", "school", "grade")
    search_fields = ("student_name", "student_phone_num", "student_parent_phone_num")
    actions = [
        "duplicate_students",
        "change_student_school_to_sewha",
        "change_student_school_to_sewha_girls",
        "change_student_school_to_combined",
        "set_student_grade_to_1",
        "set_student_grade_to_2",
        "set_student_grade_to_3",
    ]

    def duplicate_students(self, request, queryset):
        # 선택된 학생들에 대해 반복
        for student in queryset:
            # 1부터 20까지 반복하여 복사본 생성
            for i in range(1, 21):
                # 새로운 학생 이름 생성 (기존 이름 + 숫자)
                new_name = f"{student.student_name}{i}"

                # 새로운 학생 객체 생성
                new_student = Student(
                    student_name=new_name,
                    student_phone_num=student.student_phone_num,
                    student_parent_phone_num=student.student_parent_phone_num,
                    student_subject=student.student_subject,
                    school=student.school,
                    grade=student.grade,
                    assigned_teacher=student.assigned_teacher,
                )

                # 새 학생 저장
                new_student.save()

        # 성공 메시지 표시
        self.message_user(request, f"선택한 학생의 복사본이 성공적으로 생성되었습니다.")

    def change_student_school_to_sewha(self, request, queryset):
        for student in queryset:
            student.school = "세화고"
            student.save()

    def change_student_school_to_sewha_girls(self, request, queryset):
        for student in queryset:
            student.school = "세화여고"
            student.save()

    def change_student_school_to_combined(self, request, queryset):
        for student in queryset:
            student.school = "연합반"
            student.save()

    def set_student_grade_to_1(self, request, queryset):
        for student in queryset:
            student.grade = "1학년"
            student.save()

    def set_student_grade_to_2(self, request, queryset):
        for student in queryset:
            student.grade = "2학년"
            student.save()

    def set_student_grade_to_3(self, request, queryset):
        for student in queryset:
            student.grade = "3학년"
            student.save()

    def get_subject(self, obj):
        return obj.student_subject.subject if obj.student_subject else "-"

    get_subject.short_description = "과목"

    def get_teacher(self, obj):
        return obj.assigned_teacher.user_name if obj.assigned_teacher else "미배정"

    get_teacher.short_description = "담당 선생님"


# Subject 관리자 설정
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("subject", "id")
    search_fields = ("subject",)


# Clinic 관리자 설정
class ClinicAdmin(admin.ModelAdmin):
    list_display = ("get_teacher", "get_subject", "get_time", "id")
    list_filter = ("clinic_subject", "clinic_teacher", "clinic_time")

    def get_teacher(self, obj):
        return obj.clinic_teacher.user_name

    get_teacher.short_description = "선생님"

    def get_subject(self, obj):
        return obj.clinic_subject.subject

    get_subject.short_description = "과목"

    def get_time(self, obj):
        return f"{obj.clinic_time.get_time_day_display()} {obj.clinic_time.time_slot.strftime('%H:%M')}"

    get_time.short_description = "시간"


# Comment 관리자 설정
class CommentAdmin(admin.ModelAdmin):
    list_display = ("get_author", "get_student", "created_at")
    list_filter = ("created_at",)
    search_fields = ("comment_text",)

    def get_author(self, obj):
        return obj.comment_author.user_name

    get_author.short_description = "작성자"

    def get_student(self, obj):
        return obj.comment_student.student_name

    get_student.short_description = "학생"


# 관리자 사이트에 모델 등록
admin.site.register(User, CustomUserAdmin)
admin.site.register(Student, StudentAdmin)
admin.site.register(Subject, SubjectAdmin)
admin.site.register(Time, TimeAdmin)
admin.site.register(Clinic, ClinicAdmin)
admin.site.register(Comment, CommentAdmin)
