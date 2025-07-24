from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin

# Student 모델 삭제로 import에서 제거
from .models import Subject, Clinic, StudentPlacement, WeeklyReservationPeriod
import datetime
from django import forms

User = get_user_model()


# User 관리자 설정 - 학생 정보도 포함하도록 확장
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = (
        "id",
        "username",
        "name",  # user_name → name
        "is_teacher",
        "is_student",
        "is_staff",
        "is_superuser",
        "school",
        "grade",
    )
    list_filter = (
        "is_teacher",
        "is_student",
        "is_staff",
        "is_superuser",
        "school",
        "grade",
    )
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (
            "개인정보",
            {
                "fields": (
                    "name",  # user_name → name
                    "phone_num",  # user_phone_num → phone_num
                    "subject",  # user_subject → subject
                )
            },
        ),
        (
            "학생 정보 (학생인 경우만)",
            {
                "fields": (
                    "student_phone_num",
                    "student_parent_phone_num",
                    "school",
                    "grade",
                )
            },
        ),
        (
            "권한",
            {
                "fields": (
                    "is_teacher",
                    "is_student",
                    "is_staff",
                    "is_superuser",
                    "is_active",
                )
            },
        ),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "name",  # user_name → name
                    "password1",
                    "password2",
                    "is_teacher",
                    "is_student",
                    "is_staff",
                    "is_superuser",
                    "is_active",
                ),
            },
        ),
    )
    search_fields = ("username", "name")  # user_name → name
    ordering = ("username",)


# StudentAdmin 삭제 - User 모델로 통합됨
# Student 모델이 삭제되었으므로 더 이상 필요하지 않음


# Subject 관리자 설정
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("subject", "id")
    search_fields = ("subject",)


# Clinic 관리자 설정 (선착순 보충 예약 시스템에 맞게 수정)
class ClinicAdmin(admin.ModelAdmin):
    list_display = (
        "get_teacher",
        "get_subject",
        "get_day",
        "get_time",
        "get_room",
        "get_capacity",
        "get_current_count",
        "get_active_status",
        "id",
    )
    list_filter = (
        "is_active",  # 활성화 상태 필터 추가
        "clinic_subject",
        "clinic_teacher",
        "clinic_day",
        "clinic_time",
        "clinic_room",
    )
    filter_horizontal = ("clinic_students",)
    actions = [
        "activate_clinics",
        "deactivate_clinics",
        "reset_clinic_students",
        "create_weekly_clinics1",
    ]

    def get_teacher(self, obj):
        return obj.clinic_teacher.name  # user_name → name

    get_teacher.short_description = "선생님"

    def get_subject(self, obj):
        return obj.clinic_subject.subject

    get_subject.short_description = "과목"

    def get_day(self, obj):
        return obj.get_clinic_day_display()

    get_day.short_description = "요일"

    def get_time(self, obj):
        return obj.clinic_time

    get_time.short_description = "시간"

    def get_room(self, obj):
        return obj.clinic_room

    get_room.short_description = "강의실"

    def get_capacity(self, obj):
        return obj.clinic_capacity

    get_capacity.short_description = "정원"

    def get_current_count(self, obj):
        return f"{obj.get_current_students_count()}/{obj.clinic_capacity}"

    get_current_count.short_description = "현재인원/정원"

    def get_active_status(self, obj):
        return obj.is_active

    get_active_status.short_description = "활성화 상태"
    get_active_status.boolean = True

    # 클리닉 관리 액션들
    def activate_clinics(self, request, queryset):
        """선택한 클리닉들을 활성화"""
        count = queryset.update(is_active=True)
        self.message_user(request, f"{count}개의 클리닉이 활성화되었습니다.")

    activate_clinics.short_description = "선택한 클리닉 활성화"

    def deactivate_clinics(self, request, queryset):
        """선택한 클리닉들을 비활성화"""
        count = queryset.update(is_active=False)
        self.message_user(request, f"{count}개의 클리닉이 비활성화되었습니다.")

    deactivate_clinics.short_description = "선택한 클리닉 비활성화"

    def reset_clinic_students(self, request, queryset):
        """선택한 클리닉들의 학생 예약을 모두 초기화"""
        total_reset = 0
        for clinic in queryset:
            student_count = clinic.clinic_students.count()
            clinic.clinic_students.clear()
            total_reset += student_count

        self.message_user(
            request,
            f"{queryset.count()}개 클리닉에서 총 {total_reset}명의 학생 예약이 초기화되었습니다.",
        )

    reset_clinic_students.short_description = "선택한 클리닉의 학생 예약 초기화"

    def create_weekly_clinics1(self, request, queryset):
        """모든 요일(월~토)에 18:00-21:00 클리닉 생성"""
        from .models import Subject, User

        # 기본 설정
        days = ["mon", "tue", "wed", "thu", "fri", "sat"]
        times = ["18:00", "19:00", "20:00", "21:00"]
        rooms = [
            "1강의실",
        ]

        try:
            # 기본 과목 가져오기
            default_subject = Subject.objects.filter(subject="physics1").first()
            if not default_subject:
                default_subject = Subject.objects.first()

            if not default_subject:
                self.message_user(
                    request, "과목이 없습니다. 먼저 과목을 생성해주세요.", level="ERROR"
                )
                return

            # 기본 강사 가져오기 (첫 번째 강사)
            default_teacher = User.objects.filter(is_teacher=True).first()

            created_count = 0

            for day in days:
                for time in times:
                    for room in rooms:
                        # 이미 존재하는지 확인
                        if not Clinic.objects.filter(
                            clinic_day=day, clinic_time=time, clinic_room=room
                        ).exists():
                            Clinic.objects.create(
                                clinic_teacher=default_teacher,
                                clinic_day=day,
                                clinic_time=time,
                                clinic_room=room,
                                clinic_capacity=6,
                                clinic_subject=default_subject,
                                is_active=False,  # 기본적으로 비활성화 상태로 생성
                            )
                            created_count += 1

            self.message_user(
                request,
                f"{created_count}개의 클리닉이 생성되었습니다. (기본: 비활성화 상태)",
            )

        except Exception as e:
            self.message_user(request, f"클리닉 생성 중 오류: {str(e)}", level="ERROR")

    create_weekly_clinics1.short_description = (
        "클리닉 생성 (월~토, 18:00-21:00, 1강의실)"
    )


# StudentPlacement 관리자 설정 - User 모델 기반으로 수정
class StudentPlacementAdmin(admin.ModelAdmin):
    list_display = ("get_student", "get_teacher", "get_subject", "created_at")
    list_filter = ("subject", "teacher", "created_at")
    search_fields = ("student__name", "teacher__name")  # student_name, user_name → name

    def get_student(self, obj):
        return obj.student.name  # Student 모델 → User 모델

    get_student.short_description = "학생"

    def get_teacher(self, obj):
        return obj.teacher.name  # user_name → name

    get_teacher.short_description = "선생님"

    def get_subject(self, obj):
        return obj.subject.subject

    get_subject.short_description = "과목"


# WeeklyReservationPeriod 관리자 설정 (주간 예약 기간 관리)
class WeeklyReservationPeriodAdmin(admin.ModelAdmin):
    list_display = (
        "get_week_range",
        "get_status",
        "get_reservation_period",
        "total_clinics",
        "total_reservations",
        "created_at",
    )
    list_filter = ("status", "week_start_date", "created_at")
    search_fields = ("week_start_date", "week_end_date")
    readonly_fields = ("created_at", "updated_at")
    actions = ["create_next_week_period", "close_period", "reset_reservations"]

    def get_week_range(self, obj):
        return f"{obj.week_start_date} ~ {obj.week_end_date}"

    get_week_range.short_description = "주 기간"

    def get_status(self, obj):
        return obj.get_status_display()

    get_status.short_description = "상태"

    def get_reservation_period(self, obj):
        return f"{obj.reservation_start.strftime('%m/%d %H:%M')} ~ {obj.reservation_end.strftime('%m/%d %H:%M')}"

    get_reservation_period.short_description = "예약 기간"

    def create_next_week_period(self, request, queryset):
        """다음 주 예약 기간 생성"""
        try:
            period, created = WeeklyReservationPeriod.create_weekly_period()
            if created:
                self.message_user(
                    request, f"다음 주 예약 기간이 생성되었습니다: {period}"
                )
            else:
                self.message_user(
                    request, f"해당 주 예약 기간이 이미 존재합니다: {period}"
                )
        except Exception as e:
            self.message_user(
                request, f"예약 기간 생성 중 오류: {str(e)}", level="ERROR"
            )

    create_next_week_period.short_description = "다음 주 예약 기간 생성"

    def close_period(self, request, queryset):
        """선택된 예약 기간들을 마감 상태로 변경"""
        count = queryset.update(status="closed")
        self.message_user(request, f"{count}개의 예약 기간이 마감되었습니다.")

    close_period.short_description = "선택된 기간 마감"

    def reset_reservations(self, request, queryset):
        """선택된 기간의 모든 클리닉 예약 초기화"""
        total_reset = 0
        for period in queryset:
            # 해당 기간의 모든 클리닉에서 학생 예약 제거
            for clinic in period.clinics.all():
                clinic.clinic_students.clear()
                total_reset += 1

            # 기간 상태를 pending으로 변경
            period.status = "pending"
            period.total_reservations = 0
            period.save()

        self.message_user(request, f"{total_reset}개 클리닉의 예약이 초기화되었습니다.")

    reset_reservations.short_description = "선택된 기간의 예약 초기화"


# 관리자 사이트에 모델 등록
admin.site.register(User, CustomUserAdmin)
# admin.site.register(Student, StudentAdmin)  # Student 모델 삭제로 주석처리
admin.site.register(Subject, SubjectAdmin)
admin.site.register(Clinic, ClinicAdmin)
admin.site.register(StudentPlacement, StudentPlacementAdmin)
admin.site.register(WeeklyReservationPeriod, WeeklyReservationPeriodAdmin)

# 보충 시스템 개편으로 Time, Comment 모델 제거
# admin.site.register(Time, TimeAdmin)
# admin.site.register(Comment, CommentAdmin)


# 보충 시스템 개편으로 TimeAdmin 주석처리
# class TimeAdmin(admin.ModelAdmin):
#     list_display = ("id", "time_day", "time_slot_formatted")
#     list_filter = ("time_day",)
#     search_fields = ("time_day",)
#     actions = ["create_timeslots_for_all_days"]
#
#     def time_slot_formatted(self, obj):
#         return obj.time_slot.strftime("%H:%M")
#
#     time_slot_formatted.short_description = "시간"
#
#     def create_timeslots_for_all_days(self, request, queryset):
#         """
#         모든 요일(월~일)에 대해 08:00부터 22:00까지 시간 슬롯을 생성하는 액션
#         이미 존재하는 시간 슬롯은 중복 생성하지 않음
#         """
#         days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
#         count = 0
#
#         for day in days:
#             # 08:00부터 22:00까지 (22:00 포함하지 않음, 즉 21:00까지)
#             for hour in range(8, 22):
#                 time_obj = datetime.time(hour=hour, minute=0)
#                 # 이미 존재하는지 확인하여 중복 생성 방지
#                 if not Time.objects.filter(time_day=day, time_slot=time_obj).exists():
#                     Time.objects.create(time_day=day, time_slot=time_obj)
#                     count += 1
#
#         self.message_user(request, f"{count}개의 시간 슬롯이 생성되었습니다.")
#
#     create_timeslots_for_all_days.short_description = (
#         "모든 요일에 08:00~21:00 시간 슬롯 생성"
#     )


# 보충 시스템 개편으로 CommentAdmin 주석처리
# class CommentAdmin(admin.ModelAdmin):
#     list_display = ("get_author", "get_student", "created_at")
#     list_filter = ("created_at",)
#     search_fields = ("comment_text",)
#
#     def get_author(self, obj):
#         return obj.comment_author.user_name
#
#     get_author.short_description = "작성자"
#
#     def get_student(self, obj):
#         return obj.comment_student.student_name
#
#     get_student.short_description = "학생"
