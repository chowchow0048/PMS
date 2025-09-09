from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin

# Student 모델 삭제로 import에서 제거
from .models import (
    Subject,
    Clinic,
    StudentPlacement,
    WeeklyReservationPeriod,
    ClinicAttendance,  # 클리닉 출석 모델 추가
    LoginHistory,
    UserSession,
)
import datetime
from django import forms

User = get_user_model()


# 출석 기록 인라인 (User 편집 시 출석 기록도 함께 표시)
class ClinicAttendanceInline(admin.TabularInline):
    model = ClinicAttendance
    fk_name = "student"  # User 모델의 어떤 필드를 참조하는지 명시
    extra = 0  # 빈 폼 개수 (0으로 설정하여 기존 데이터만 표시)
    fields = (
        "clinic",
        "expected_clinic_date",
        "actual_attendance_date",
        "attendance_type",
        "get_clinic_info_short",
    )
    readonly_fields = ("get_clinic_info_short",)
    ordering = ("-expected_clinic_date",)  # 최신 예상 클리닉 날짜부터 정렬

    def get_clinic_info_short(self, obj):
        """클리닉 정보를 간단하게 표시"""
        if obj and obj.clinic:
            clinic = obj.clinic
            subject_name = (
                getattr(
                    clinic.clinic_subject, "subject_kr", clinic.clinic_subject.subject
                )
                if clinic.clinic_subject
                else "과목미정"
            )
            teacher_name = (
                clinic.clinic_teacher.name if clinic.clinic_teacher else "강사미정"
            )
            return f"{subject_name} - {clinic.get_clinic_day_display()} {clinic.clinic_time} ({clinic.clinic_room}) - {teacher_name}"
        return "-"

    get_clinic_info_short.short_description = "클리닉 정보"

    def get_queryset(self, request):
        """최적화된 쿼리셋 (select_related 사용)"""
        return (
            super()
            .get_queryset(request)
            .select_related(
                "clinic", "clinic__clinic_subject", "clinic__clinic_teacher"
            )
        )

    def has_add_permission(self, request, obj=None):
        """인라인에서 추가 권한은 제한 (별도 ClinicAttendanceAdmin에서 관리)"""
        return False


# User 관리자 설정 - 학생 정보도 포함하도록 확장
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = (
        "is_active",
        "id",
        "username",
        "name",  # user_name → name
        "is_teacher",
        "is_student",
        "school",
        "grade",
        "non_pass",
        "essential_clinic",
    )
    list_filter = (
        "is_teacher",
        "is_student",
        "is_staff",
        "is_superuser",
        "is_active",
        "school",
        "grade",
        "no_show",  # 무단결석 횟수로 필터링 추가
        "subject",  # 과목 필터 추가
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
            "학생 정보",
            {
                "fields": (
                    "student_phone_num",
                    "student_parent_phone_num",
                    "school",
                    "grade",
                    "no_show",  # 무단결석 횟수 추가
                    "non_pass",  # 논패스 클리닉 대상자 여부
                    "essential_clinic",  # 의무 클리닉 신청 여부
                )
            },
        ),
        (
            "출석 정보",
            {
                "fields": (
                    "get_total_attendance_info",
                    "get_recent_attendances_display",
                ),
                "classes": ("collapse",),  # 접을 수 있는 섹션으로 설정
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
        (
            "날짜 정보",
            {
                "fields": (
                    "date_joined",
                    "last_login",
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
    readonly_fields = (
        "get_total_attendance_info",
        "get_recent_attendances_display",
    )  # 읽기 전용 필드 추가
    search_fields = (
        "username",
        "name",
        "student_parent_phone_num",
        "phone_num",
    )  # 검색 필드 확장
    ordering = ("username",)
    actions = [
        "regenerate_student_credentials",
        "reset_user_password_to_username",  # 모든 사용자 대상 비밀번호 초기화 액션 추가
        "reset_no_show_count",
        "set_essential_clinic_to_true",
        "set_essential_clinic_to_false",
    ]
    inlines = [ClinicAttendanceInline]  # 출석 기록 인라인 추가

    def get_inlines(self, request, obj):
        """학생인 경우에만 출석 기록 인라인 표시"""
        if obj and obj.is_student:
            return [ClinicAttendanceInline]
        return []  # 강사/관리자는 출석 기록 인라인 없음

    def regenerate_student_credentials(self, request, queryset):
        """
        선택된 학생 사용자들의 아이디와 비밀번호를 새로운 규칙으로 재생성
        (연도2자리 + 학교구분2자리 + 학년1자리 + 부모님번호 마지막 4자리)
        """
        # is_student=True인 사용자만 필터링
        student_users = queryset.filter(is_student=True)

        if not student_users.exists():
            self.message_user(
                request, "선택된 사용자 중 학생이 없습니다.", level="WARNING"
            )
            return

        # 학생 아이디 생성 함수
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

        # 결과 추적
        success_count = 0
        error_count = 0
        error_messages = []

        for user in student_users:
            try:
                # 필수 정보 확인
                if not all([user.school, user.grade, user.student_parent_phone_num]):
                    error_messages.append(
                        f"{user.name}: 학교, 학년, 부모님 전화번호 정보 부족"
                    )
                    error_count += 1
                    continue

                # 새로운 아이디 생성
                new_username = generate_student_username(
                    user.school, user.grade, user.student_parent_phone_num
                )

                # 중복 아이디 확인 (자신 제외)
                if (
                    User.objects.filter(username=new_username)
                    .exclude(id=user.id)
                    .exists()
                ):
                    error_messages.append(
                        f"{user.name}: 생성된 아이디({new_username})가 이미 존재함"
                    )
                    error_count += 1
                    continue

                # 아이디와 비밀번호 업데이트
                old_username = user.username
                user.username = new_username
                user.set_password(
                    new_username
                )  # 비밀번호도 새로운 아이디와 동일하게 설정
                user.save()

                success_count += 1

            except Exception as e:
                error_messages.append(f"{user.name}: {str(e)}")
                error_count += 1

        # 결과 메시지
        if success_count > 0:
            self.message_user(
                request,
                f"{success_count}명의 학생 아이디/비밀번호가 성공적으로 변경되었습니다.",
            )

        if error_count > 0:
            self.message_user(
                request,
                f"{error_count}명의 학생 처리 중 오류 발생:\n"
                + "\n".join(error_messages),
                level="ERROR",
            )

    regenerate_student_credentials.short_description = "학생유저 아이디/비밀번호 재구성"

    def set_essential_clinic_to_true(self, request, queryset):
        """
        선택된 학생 사용자들의 의무 클리닉 신청 상태를 True로 설정
        """
        queryset.update(essential_clinic=True)
        self.message_user(
            request,
            "선택된 학생 사용자들의 의무 클리닉 신청 상태가 True로 설정되었습니다.",
        )

    set_essential_clinic_to_true.short_description = "학생 의무 클리닉 신청 상태 설정"

    def set_essential_clinic_to_false(self, request, queryset):
        """
        선택된 학생 사용자들의 의무 클리닉 신청 상태를 False로 설정
        """
        queryset.update(essential_clinic=False)
        self.message_user(
            request,
            "선택된 학생 사용자들의 의무 클리닉 신청 상태가 False로 설정되었습니다.",
        )

    set_essential_clinic_to_false.short_description = "학생 의무 클리닉 신청 상태 해제"

    def reset_user_password_to_username(self, request, queryset):
        """
        선택된 모든 사용자들의 비밀번호를 아이디(username)와 같게 초기화
        학생뿐만 아니라 모든 종류의 사용자가 대상
        """
        from django.contrib.auth.hashers import make_password

        if not queryset.exists():
            self.message_user(request, "선택된 사용자가 없습니다.", level="WARNING")
            return

        # 결과 추적
        success_count = 0
        error_count = 0
        error_messages = []

        for user in queryset:
            try:
                # 비밀번호를 아이디와 같게 설정 (Django 비밀번호 검증 우회)
                user.password = make_password(user.username)
                user.save()
                success_count += 1

            except Exception as e:
                error_messages.append(f"{user.name} ({user.username}): {str(e)}")
                error_count += 1

        # 결과 메시지
        if success_count > 0:
            self.message_user(
                request,
                f"{success_count}명의 사용자 비밀번호가 아이디와 같게 초기화되었습니다.",
            )

        if error_count > 0:
            self.message_user(
                request,
                f"{error_count}명의 사용자 처리 중 오류 발생:\n"
                + "\n".join(error_messages),
                level="ERROR",
            )

    reset_user_password_to_username.short_description = "비밀번호 초기화"

    def reset_no_show_count(self, request, queryset):
        """
        선택된 학생 사용자들의 무단결석 횟수를 0으로 초기화
        """
        # is_student=True인 사용자만 필터링
        student_users = queryset.filter(is_student=True)

        if not student_users.exists():
            self.message_user(
                request, "선택된 사용자 중 학생이 없습니다.", level="WARNING"
            )
            return

        count = student_users.update(no_show=0)
        self.message_user(
            request,
            f"{count}명의 학생 무단결석 횟수가 0으로 초기화되었습니다.",
        )

    reset_no_show_count.short_description = "학생 무단결석 횟수 초기화"

    # 출석 관련 표시 메서드들
    def get_clinic_attendance_count(self, obj):
        """학생의 총 출석 기록 수를 반환"""
        if not obj.is_student:
            return "-"
        return obj.clinic_attendances.count()

    get_clinic_attendance_count.short_description = "출석기록수"

    def get_recent_attendance_status(self, obj):
        """최근 출석 상태를 반환 (최근 5개)"""
        if not obj.is_student:
            return "-"

        recent_attendances = obj.clinic_attendances.select_related("clinic").order_by(
            "-expected_clinic_date"
        )[:5]
        if not recent_attendances:
            return "출석기록 없음"

        status_icons = {
            "attended": "✅",
            "absent": "❌",
            "sick": "🏥",
            "late": "⏰",
            "none": "❓",
        }

        statuses = []
        for attendance in recent_attendances:
            icon = status_icons.get(attendance.attendance_type, "❓")
            date_str = attendance.expected_clinic_date.strftime("%m/%d")
            statuses.append(f"{icon}{date_str}")

        return " | ".join(statuses)

    get_recent_attendance_status.short_description = "최근출석(5개)"

    def get_total_attendance_info(self, obj):
        """학생의 전체 출석 통계 정보를 반환"""
        if not obj.is_student:
            return "강사/관리자는 출석 정보가 없습니다."

        attendances = obj.clinic_attendances.all()
        if not attendances:
            return "출석 기록이 없습니다."

        total = attendances.count()
        attended = attendances.filter(attendance_type="attended").count()
        absent = attendances.filter(attendance_type="absent").count()
        sick = attendances.filter(attendance_type="sick").count()
        late = attendances.filter(attendance_type="late").count()
        none = attendances.filter(attendance_type="none").count()

        attendance_rate = (attended / total * 100) if total > 0 else 0

        return (
            f"총 {total}회 | "
            f"출석: {attended}회 | "
            f"결석: {absent}회 | "
            f"병결: {sick}회 | "
            f"지각: {late}회 | "
            f"미정: {none}회 | "
            f"출석률: {attendance_rate:.1f}%"
        )

    get_total_attendance_info.short_description = "출석 통계"

    def get_recent_attendances_display(self, obj):
        """최근 출석 기록들을 배열 형식으로 상세 표시"""
        if not obj.is_student:
            return "강사/관리자는 출석 정보가 없습니다."

        recent_attendances = obj.clinic_attendances.select_related(
            "clinic", "clinic__clinic_subject", "clinic__clinic_teacher"
        ).order_by("-expected_clinic_date")[
            :10
        ]  # 최근 10개

        if not recent_attendances:
            return "출석 기록이 없습니다."

        status_display = {
            "attended": "✅ 출석",
            "absent": "❌ 결석",
            "sick": "🏥 병결",
            "late": "⏰ 지각",
            "none": "❓ 미정",
        }

        records = []
        for attendance in recent_attendances:
            clinic = attendance.clinic
            subject_name = (
                getattr(
                    clinic.clinic_subject, "subject_kr", clinic.clinic_subject.subject
                )
                if clinic.clinic_subject
                else "과목미정"
            )
            teacher_name = (
                clinic.clinic_teacher.name if clinic.clinic_teacher else "강사미정"
            )

            record = (
                f"📅 {attendance.expected_clinic_date.strftime('%Y-%m-%d')} | "
                f"📚 {subject_name} | "
                f"👨‍🏫 {teacher_name} | "
                f"🏠 {clinic.clinic_room} | "
                f"⏰ {clinic.get_clinic_day_display()} {clinic.clinic_time} | "
                f"{status_display.get(attendance.attendance_type, '❓ 미정')}"
            )
            records.append(record)

        # HTML로 줄바꿈 처리하여 가독성 향상
        from django.utils.safestring import mark_safe

        return mark_safe("<br/>".join(records))

    get_recent_attendances_display.short_description = "최근 출석 기록 (10개)"


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
        from django.utils import timezone

        # 한국 시간으로 변환하여 표시
        start_kst = timezone.localtime(obj.reservation_start)
        end_kst = timezone.localtime(obj.reservation_end)
        return f"{start_kst.strftime('%m/%d %H:%M')} ~ {end_kst.strftime('%m/%d %H:%M')} KST"

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


# LoginHistory 관리자 설정 (로그인 추적)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "get_user",
        "ip_address",
        "get_login_success",
        "device_type",
        "browser_name",
        "os_name",
        "get_login_time",
        "get_session_duration",
    )
    list_filter = (
        "login_success",
        "device_type",
        "browser_name",
        "os_name",
        "login_at",
        "previous_session_terminated",
    )
    search_fields = (
        "user__username",
        "user__name",
        "ip_address",
        "user_agent",
    )
    readonly_fields = (
        "user",
        "session_key",
        "token_key",
        "login_at",
        "logout_at",
        "ip_address",
        "forwarded_ip",
        "user_agent",
        "device_type",
        "browser_name",
        "os_name",
        "country",
        "city",
        "isp",
        "login_success",
        "failure_reason",
        "logout_reason",
        "previous_session_terminated",
        "previous_login_ip",
    )
    date_hierarchy = "login_at"
    ordering = ("-login_at",)
    actions = ["export_login_history", "clean_old_records"]

    def get_user(self, obj):
        if obj.user:
            return f"{obj.user.username} ({obj.user.name})"
        return "Unknown User"

    get_user.short_description = "사용자"

    def get_login_success(self, obj):
        return obj.login_success

    get_login_success.short_description = "성공"
    get_login_success.boolean = True

    def get_login_time(self, obj):
        from django.utils import timezone

        # 한국 시간으로 변환하여 표시
        kst_time = timezone.localtime(obj.login_at)
        return kst_time.strftime("%m/%d %H:%M:%S KST")

    get_login_time.short_description = "로그인 시간"

    def get_session_duration(self, obj):
        duration = obj.session_duration
        if duration:
            total_seconds = int(duration.total_seconds())
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            return f"{hours}시간 {minutes}분"
        return "-"

    get_session_duration.short_description = "세션 시간"

    def export_login_history(self, request, queryset):
        """선택한 로그인 이력을 CSV로 내보내기"""
        import csv
        from django.http import HttpResponse

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="login_history.csv"'

        writer = csv.writer(response)
        writer.writerow(
            [
                "User",
                "IP Address",
                "Device Type",
                "Browser",
                "OS",
                "Login Time",
                "Logout Time",
                "Success",
                "Failure Reason",
            ]
        )

        for obj in queryset:
            from django.utils import timezone

            # 한국 시간으로 변환
            login_kst = timezone.localtime(obj.login_at)
            logout_kst = timezone.localtime(obj.logout_at) if obj.logout_at else None

            writer.writerow(
                [
                    obj.user.username if obj.user else "Unknown",
                    obj.ip_address,
                    obj.device_type,
                    obj.browser_name,
                    obj.os_name,
                    login_kst.strftime("%Y-%m-%d %H:%M:%S KST"),
                    (
                        logout_kst.strftime("%Y-%m-%d %H:%M:%S KST")
                        if logout_kst
                        else ""
                    ),
                    "Success" if obj.login_success else "Failed",
                    obj.failure_reason or "",
                ]
            )

        return response

    export_login_history.short_description = "선택한 이력을 CSV로 내보내기"

    def clean_old_records(self, request, queryset):
        """30일 이상 된 로그인 이력 삭제"""
        from django.utils import timezone
        from datetime import timedelta

        cutoff_date = timezone.now() - timedelta(days=30)
        old_records = LoginHistory.objects.filter(login_at__lt=cutoff_date)
        count = old_records.count()
        old_records.delete()

        self.message_user(request, f"{count}개의 오래된 로그인 이력이 삭제되었습니다.")

    clean_old_records.short_description = "30일 이상 된 이력 삭제"


# UserSession 관리자 설정 (현재 세션 관리)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = (
        "get_user",
        "current_ip",
        "current_device_type",
        "get_session_status",
        "get_last_activity",
        "get_created_time",
    )
    list_filter = (
        "current_device_type",
        "last_activity",
        "created_at",
    )
    search_fields = (
        "user__username",
        "user__name",
        "current_ip",
        "current_user_agent",
    )
    readonly_fields = (
        "user",
        "session_key",
        "token_key",
        "current_ip",
        "current_user_agent",
        "current_device_type",
        "created_at",
        "updated_at",
        "last_activity",
    )
    ordering = ("-last_activity",)
    actions = ["force_logout_selected", "clean_inactive_sessions"]

    def get_user(self, obj):
        return f"{obj.user.username} ({obj.user.name})"

    get_user.short_description = "사용자"

    def get_session_status(self, obj):
        return obj.is_active()

    get_session_status.short_description = "활성 상태"
    get_session_status.boolean = True

    def get_last_activity(self, obj):
        from django.utils import timezone

        # 한국 시간으로 변환하여 표시
        kst_time = timezone.localtime(obj.last_activity)
        return kst_time.strftime("%m/%d %H:%M:%S KST")

    get_last_activity.short_description = "마지막 활동"

    def get_created_time(self, obj):
        from django.utils import timezone

        # 한국 시간으로 변환하여 표시
        kst_time = timezone.localtime(obj.created_at)
        return kst_time.strftime("%m/%d %H:%M:%S KST")

    get_created_time.short_description = "생성 시간"

    def force_logout_selected(self, request, queryset):
        """선택한 사용자들을 강제 로그아웃"""
        from core.signals import force_logout_user

        count = 0
        for session in queryset:
            try:
                force_logout_user(session.user, reason="admin_forced_logout")
                count += 1
            except Exception as e:
                self.message_user(
                    request,
                    f"{session.user.username} 로그아웃 실패: {str(e)}",
                    level="ERROR",
                )

        self.message_user(request, f"{count}명의 사용자가 강제 로그아웃되었습니다.")

    force_logout_selected.short_description = "선택한 사용자 강제 로그아웃"

    def clean_inactive_sessions(self, request, queryset):
        """비활성 세션들을 정리"""
        inactive_sessions = queryset.filter(
            session_key__isnull=True, token_key__isnull=True
        )
        count = inactive_sessions.count()
        inactive_sessions.delete()

        self.message_user(request, f"{count}개의 비활성 세션이 삭제되었습니다.")

    clean_inactive_sessions.short_description = "비활성 세션 정리"


# ClinicAttendance 관리자 설정 (클리닉 출석 관리)
class ClinicAttendanceAdmin(admin.ModelAdmin):
    list_display = (
        "get_student_name",
        "get_clinic_info",
        "expected_clinic_date",
        "actual_attendance_date",
        "get_attendance_display",
        "get_created_time",
        "id",
    )
    list_filter = (
        "attendance_type",
        "expected_clinic_date",
        "actual_attendance_date",
        "clinic__clinic_day",
        "clinic__clinic_time",
        "clinic__clinic_subject",
        "created_at",
    )
    search_fields = (
        "student__name",
        "student__username",
        "clinic__clinic_teacher__name",
        "clinic__clinic_room",
    )
    readonly_fields = ("created_at", "updated_at", "reservation_date")
    date_hierarchy = "expected_clinic_date"
    ordering = ("-expected_clinic_date", "-created_at")

    # 필터링 최적화를 위한 select_related와 prefetch_related
    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "student", "clinic", "clinic__clinic_teacher", "clinic__clinic_subject"
            )
        )

    def get_student_name(self, obj):
        return f"{obj.student.name} ({obj.student.username})"

    get_student_name.short_description = "학생"

    def get_clinic_info(self, obj):
        clinic = obj.clinic
        day_display = clinic.get_clinic_day_display()
        subject_kr = getattr(
            clinic.clinic_subject, "subject_kr", clinic.clinic_subject.subject
        )
        return (
            f"{subject_kr} - {day_display} {clinic.clinic_time} ({clinic.clinic_room})"
        )

    get_clinic_info.short_description = "클리닉 정보"

    def get_attendance_display(self, obj):
        return obj.get_attendance_type_display()

    get_attendance_display.short_description = "출석 상태"

    def get_created_time(self, obj):
        from django.utils import timezone

        kst_time = timezone.localtime(obj.created_at)
        return kst_time.strftime("%m/%d %H:%M KST")

    get_created_time.short_description = "등록 시간"

    # 유용한 관리자 액션들
    actions = [
        "mark_as_attended",
        "mark_as_absent",
        "mark_as_late",
        "mark_as_sick",
        "bulk_create_for_today_clinics",
        "export_attendance_csv",
    ]

    def mark_as_attended(self, request, queryset):
        """선택한 출석 데이터를 출석으로 변경"""
        count = queryset.update(attendance_type="attended")
        self.message_user(request, f"{count}개의 출석이 '출석'으로 변경되었습니다.")

    mark_as_attended.short_description = "선택한 출석을 '출석'으로 변경"

    def mark_as_absent(self, request, queryset):
        """선택한 출석 데이터를 결석으로 변경"""
        count = queryset.update(attendance_type="absent")
        self.message_user(request, f"{count}개의 출석이 '결석'으로 변경되었습니다.")

    mark_as_absent.short_description = "선택한 출석을 '결석'으로 변경"

    def mark_as_late(self, request, queryset):
        """선택한 출석 데이터를 지각으로 변경"""
        count = queryset.update(attendance_type="late")
        self.message_user(request, f"{count}개의 출석이 '지각'으로 변경되었습니다.")

    mark_as_late.short_description = "선택한 출석을 '지각'으로 변경"

    def mark_as_sick(self, request, queryset):
        """선택한 출석 데이터를 병결로 변경"""
        count = queryset.update(attendance_type="sick")
        self.message_user(request, f"{count}개의 출석이 '병결'으로 변경되었습니다.")

    mark_as_sick.short_description = "선택한 출석을 '병결'으로 변경"

    def bulk_create_for_today_clinics(self, request, queryset):
        """
        [더 이상 필요 없는 기능] 오늘 활성화된 모든 클리닉에 대해 출석 데이터 일괄 생성

        ⚠️ 주의: 2025년 1월부터 클리닉 예약 시 출석 데이터가 자동으로 생성되므로
        이 기능은 더 이상 필요하지 않습니다.

        기존 시스템과의 호환성을 위해 남겨두지만, 실제로는 거의 사용되지 않을 것입니다.
        """
        from django.utils import timezone

        today = timezone.now().date()
        today_weekday = today.weekday()  # 0=월요일

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
        today_day = day_mapping.get(today_weekday, "mon")

        # 오늘 요일의 활성화된 클리닉들 조회
        active_clinics = Clinic.objects.filter(
            clinic_day=today_day, is_active=True
        ).prefetch_related("clinic_students")

        created_count = 0
        existing_count = 0

        for clinic in active_clinics:
            for student in clinic.clinic_students.all():
                # 이미 출석 데이터가 있는지 확인 (get_or_create로 중복 방지)
                attendance, created = ClinicAttendance.objects.get_or_create(
                    clinic=clinic,
                    student=student,
                    date=today,
                    defaults={"attendance_type": "none"},
                )
                if created:
                    created_count += 1
                else:
                    existing_count += 1

        self.message_user(
            request,
            f"출석 데이터 처리 완료: 신규 {created_count}개, 기존 {existing_count}개 "
            f"(참고: 이제 예약 시 출석 데이터가 자동 생성됩니다)",
        )

    bulk_create_for_today_clinics.short_description = (
        "[더 이상 필요 없음] 오늘 클리닉의 출석 데이터 일괄 생성"
    )

    def export_attendance_csv(self, request, queryset):
        """선택한 출석 데이터를 CSV로 내보내기"""
        import csv
        from django.http import HttpResponse

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="clinic_attendance.csv"'

        writer = csv.writer(response)
        writer.writerow(
            [
                "Date",
                "Student Name",
                "Student ID",
                "School",
                "Grade",
                "Clinic Subject",
                "Clinic Day",
                "Clinic Time",
                "Room",
                "Teacher",
                "Attendance Type",
                "Created At",
            ]
        )

        for obj in queryset:
            from django.utils import timezone

            created_kst = timezone.localtime(obj.created_at)

            writer.writerow(
                [
                    obj.expected_clinic_date.strftime("%Y-%m-%d"),
                    obj.student.name,
                    obj.student.username,
                    obj.student.school,
                    obj.student.grade,
                    getattr(
                        obj.clinic.clinic_subject,
                        "subject_kr",
                        obj.clinic.clinic_subject.subject,
                    ),
                    obj.clinic.get_clinic_day_display(),
                    obj.clinic.clinic_time,
                    obj.clinic.clinic_room,
                    obj.clinic.clinic_teacher.name,
                    obj.get_attendance_type_display(),
                    created_kst.strftime("%Y-%m-%d %H:%M:%S KST"),
                ]
            )

        return response

    export_attendance_csv.short_description = "선택한 출석 데이터를 CSV로 내보내기"


# 관리자 사이트에 모델 등록
admin.site.register(User, CustomUserAdmin)
# admin.site.register(Student, StudentAdmin)  # Student 모델 삭제로 주석처리
admin.site.register(Subject, SubjectAdmin)
admin.site.register(Clinic, ClinicAdmin)
admin.site.register(StudentPlacement, StudentPlacementAdmin)
admin.site.register(WeeklyReservationPeriod, WeeklyReservationPeriodAdmin)
admin.site.register(LoginHistory, LoginHistoryAdmin)
admin.site.register(UserSession, UserSessionAdmin)
admin.site.register(ClinicAttendance, ClinicAttendanceAdmin)

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
