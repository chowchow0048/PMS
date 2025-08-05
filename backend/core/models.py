"""
이 파일은 시스템의 핵심 데이터 모델을 정의합니다.
User, Subject, Time, Clinic, Comment 등의 기본 모델을 포함하며,
시스템 전체에서 사용되는 데이터 구조를 담당합니다.
"""

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from datetime import datetime, timedelta
from django.utils import timezone


class Subject(models.Model):
    """과목 모델"""

    subject = models.CharField(max_length=50, verbose_name="과목명")  # 과목명
    subject_kr = models.CharField(
        max_length=50, default="한글과목명", verbose_name="한글과목명"
    )  # 과목명 한글

    def __str__(self):
        return self.subject


class User(AbstractUser):
    """사용자 모델 - 학생과 강사 정보를 모두 포함"""

    # 기존 사용자 공통 필드
    name = models.CharField(max_length=100, verbose_name="이름")  # 사용자 이름
    phone_num = models.CharField(
        max_length=15, default="", blank=True, verbose_name="전화번호"
    )  # 전화번호
    subject = models.ForeignKey(
        Subject,
        on_delete=models.SET_NULL,
        default=1,  # physics1의 ID(1)를 기본값으로 설정
        null=True,
        blank=True,
        related_name="teachers",
        verbose_name="과목",
    )  # 담당 과목 (강사용) 또는 수강 과목 (학생용)
    is_teacher = models.BooleanField(default=True, verbose_name="강사")  # 강사 여부
    is_student = models.BooleanField(
        default=False, verbose_name="학생"
    )  # 학생 여부 (선착순 예약 시스템용)

    # 학생 전용 필드들 (기존 Student 모델에서 이전)
    SCHOOL_CHOICES = (
        ("세화고", "세화고"),
        ("세화여고", "세화여고"),
        ("연합반", "연합반"),
    )

    GRADE_CHOICES = (
        ("예비고1", "예비고1"),
        ("1학년", "1학년"),
        ("2학년", "2학년"),
        ("3학년", "3학년"),
    )

    student_phone_num = models.CharField(
        max_length=15, default="", blank=True, verbose_name="학생 전화번호"
    )  # 학생 전화번호
    student_parent_phone_num = models.CharField(
        max_length=15, default="", blank=True, verbose_name="학부모 전화번호"
    )  # 학부모 전화번호 (학생인 경우 필수)
    school = models.CharField(
        max_length=100,
        choices=SCHOOL_CHOICES,
        default="",
        blank=True,
        verbose_name="학교",
    )  # 학교 (학생인 경우만)
    grade = models.CharField(
        max_length=10,
        choices=GRADE_CHOICES,
        default="",
        blank=True,
        verbose_name="학년",
    )  # 학년 (학생인 경우만)

    # 노쇼 관리 필드
    no_show = models.IntegerField(
        default=0,
        verbose_name="무단결석 횟수",
        help_text="2회 이상 무단결석 시 보충 예약이 제한됩니다.",
    )  # 무단결석 횟수

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """
        권한 계층 유지:
        - 슈퍼유저는 관리자 이상의 권한을 가짐
        - 관리자는 강사 이상의 권한을 가짐
        - 학생은 강사 권한을 가질 수 없음 (상호 배타적)
        """
        if self.is_superuser:
            self.is_staff = True

        if self.is_staff:
            self.is_teacher = True

        # 학생과 강사는 상호 배타적 관계
        if self.is_student:
            self.is_teacher = False
            self.is_staff = False
            self.is_superuser = False

        super().save(*args, **kwargs)


class WeeklyReservationPeriod(models.Model):
    """주간 클리닉 예약 기간 관리 모델"""

    STATUS_CHOICES = (
        ("pending", "대기중"),  # 예약 기간 시작 전
        ("open", "예약 가능"),  # 현재 예약 가능한 기간
        ("closed", "예약 마감"),  # 예약 마감 (일요일)
        ("completed", "완료"),  # 해당 주 클리닉 종료
    )

    week_start_date = models.DateField(
        verbose_name="주 시작 날짜"
    )  # 해당 주의 월요일 날짜
    week_end_date = models.DateField(
        verbose_name="주 종료 날짜"
    )  # 해당 주의 일요일 날짜
    reservation_start = models.DateTimeField(
        verbose_name="예약 시작 시간"
    )  # 예약 시작 시간 (월요일 00:00)
    reservation_end = models.DateTimeField(
        verbose_name="예약 마감 시간"
    )  # 예약 마감 시간 (일요일 00:00)
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="pending",
        verbose_name="상태",
    )

    # 통계 정보
    total_clinics = models.IntegerField(default=0)  # 해당 주 전체 클리닉 수
    total_reservations = models.IntegerField(default=0)  # 전체 예약 수
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-week_start_date"]
        unique_together = ["week_start_date", "week_end_date"]

    def __str__(self):
        return f"{self.week_start_date} ~ {self.week_end_date} ({self.get_status_display()})"

    def is_reservation_open(self):
        """현재 예약이 가능한 기간인지 확인"""
        now = timezone.now()
        return (
            self.status == "open"
            and self.reservation_start <= now < self.reservation_end
        )

    def get_remaining_time(self):
        """예약 마감까지 남은 시간 반환"""
        if self.status == "closed" or self.status == "completed":
            return timedelta(0)

        now = timezone.now()
        if now >= self.reservation_end:
            return timedelta(0)

        return self.reservation_end - now

    @classmethod
    def get_current_period(cls):
        """현재 주에 해당하는 예약 기간 반환"""
        today = timezone.now().date()

        # 현재 주의 월요일 찾기 (ISO 주 기준: 월요일이 주의 시작)
        days_since_monday = today.weekday()
        monday = today - timedelta(days=days_since_monday)

        try:
            return cls.objects.get(week_start_date=monday)
        except cls.DoesNotExist:
            return None

    @classmethod
    def create_weekly_period(cls, start_date=None):
        """새로운 주간 예약 기간 생성"""
        if start_date is None:
            # 다음 주 월요일
            today = timezone.now().date()
            days_since_monday = today.weekday()
            next_monday = today + timedelta(days=(7 - days_since_monday))
        else:
            next_monday = start_date

        # 해당 주의 일요일
        sunday = next_monday + timedelta(days=6)

        # 예약 시작: 월요일 00:00
        reservation_start = timezone.make_aware(
            datetime.combine(next_monday, datetime.min.time())
        )

        # 예약 마감: 일요일 00:00 (토요일 자정)
        reservation_end = timezone.make_aware(
            datetime.combine(sunday, datetime.min.time())
        )

        period, created = cls.objects.get_or_create(
            week_start_date=next_monday,
            week_end_date=sunday,
            defaults={
                "reservation_start": reservation_start,
                "reservation_end": reservation_end,
                "status": "pending",
            },
        )

        return period, created


class Clinic(models.Model):
    """클리닉 예약 모델 - 선착순 보충 예약 시스템"""

    DAY_CHOICES = (
        ("mon", "월요일"),
        ("tue", "화요일"),
        ("wed", "수요일"),
        ("thu", "목요일"),
        ("fri", "금요일"),
        ("sat", "토요일"),
        ("sun", "일요일"),
    )

    TIME_CHOICES = (
        ("18:00", "18:00-19:00"),
        ("19:00", "19:00-20:00"),
        ("20:00", "20:00-21:00"),
        ("21:00", "21:00-22:00"),
    )

    ROOM_CHOICES = (
        ("1강의실", "1강의실"),
        ("2강의실", "2강의실"),
        ("3강의실", "3강의실"),
        ("4강의실", "4강의실"),
        ("5강의실", "5강의실"),
        ("6강의실", "6강의실"),
        ("7강의실", "7강의실"),
        ("8강의실", "8강의실"),
    )

    clinic_teacher = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="assigned_clinics",
        limit_choices_to={"is_teacher": True},
        verbose_name="담당 강사",
        blank=True,
        null=True,
    )  # 담당 강사
    clinic_students = models.ManyToManyField(
        User,
        blank=True,
        related_name="enrolled_clinics",
        limit_choices_to={"is_student": True},
        verbose_name="예약한 학생들",
        default=None,
    )  # 예약한 학생들 (User 모델에서 is_student=True인 사용자들)
    clinic_day = models.CharField(
        max_length=3, choices=DAY_CHOICES, default="mon", verbose_name="클리닉 요일"
    )  # 클리닉 요일
    clinic_time = models.CharField(
        max_length=5, choices=TIME_CHOICES, default="18:00", verbose_name="클리닉 시간"
    )  # 클리닉 시간
    clinic_room = models.CharField(
        max_length=10, choices=ROOM_CHOICES, default="1강의실", verbose_name="강의실"
    )  # 강의실
    clinic_capacity = models.IntegerField(default=6, verbose_name="정원")  # 정원
    clinic_subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="related_clinics",
        default=1,  # physics1의 ID(1)를 기본값으로 설정
        verbose_name="과목",
        null=True,  # null=True 추가
        blank=True,  # blank=True 추가
    )  # 클리닉 과목

    # 클리닉 활성화 상태 (새로 추가)
    is_active = models.BooleanField(
        default=False,
        verbose_name="활성화 상태",
        help_text="활성화된 클리닉만 예약 가능합니다.",
    )  # 클리닉 활성화 여부

    # 주간 기간 연결 (삭제 예정 - 기존 코드 호환성을 위해 일시적으로 유지)
    weekly_period = models.ForeignKey(
        WeeklyReservationPeriod,
        on_delete=models.CASCADE,
        related_name="clinics",
        null=True,
        blank=True,
        verbose_name="주간 예약 기간",
    )  # 해당하는 주간 예약 기간 (향후 삭제 예정)

    class Meta:
        # 요일, 시간, 강의실은 고유해야 함 (중복 방지)
        unique_together = ("clinic_day", "clinic_time", "clinic_room")

    def __str__(self):
        return f"{self.clinic_subject} - {self.get_clinic_day_display()} {self.clinic_time} ({self.clinic_room})"

    def get_current_students_count(self):
        """현재 예약된 학생 수 반환"""
        return self.clinic_students.count()

    def is_full(self):
        """정원이 찬 상태인지 확인"""
        return self.get_current_students_count() >= self.clinic_capacity

    def get_remaining_spots(self):
        """남은 자리 수 반환"""
        return self.clinic_capacity - self.get_current_students_count()

    def can_reserve(self):
        """예약 가능한 상태인지 확인 (활성화 상태 + 정원 체크)"""
        # 비활성화된 클리닉은 예약 불가
        if not self.is_active:
            return False

        # 정원이 찬 클리닉은 예약 불가
        if self.is_full():
            return False

        return True


class ClinicAttendance(models.Model):
    """클리닉 출석 관리 모델"""

    ATTENDANCE_CHOICES = (
        ("attended", "출석"),
        ("absent", "결석"),
        ("sick", "병결"),
        ("late", "지각"),
        ("none", "미정"),
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="활성화 상태",
        help_text="활성화된 출석 데이터만 조회 가능합니다.",
    )  # 활성화 상태
    clinic = models.ForeignKey(
        Clinic,
        on_delete=models.CASCADE,
        related_name="attendances",
        verbose_name="클리닉",
    )  # 클리닉
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="clinic_attendances",
        limit_choices_to={"is_student": True},
        verbose_name="학생",
    )  # 학생 (User 모델에서 is_student=True인 사용자)
    date = models.DateField(
        null=True,
        blank=True,
        verbose_name="출석 날짜",
        help_text="출석을 체크한 날짜 (년-월-일). 예약 생성 시에는 NULL, 출석 체크 시에만 설정됨.",
    )  # 출석 날짜 (년-월-일까지만)
    attendance_type = models.CharField(
        max_length=10,
        choices=ATTENDANCE_CHOICES,
        verbose_name="출석 상태",
        default="none",
    )  # 출석 상태 (출석/결석/지각/병결)

    # 메타데이터
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="보충 예약 생성 시간"
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="보충 예약 수정 시간")

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = "클리닉 출석"
        verbose_name_plural = "클리닉 출석"
        # 같은 학생이 같은 클리닉에 같은 날짜에 중복 출석 체크 방지
        unique_together = ("clinic", "student", "date")
        indexes = [
            models.Index(fields=["student", "-date"]),
            models.Index(fields=["clinic", "-date"]),
            models.Index(fields=["attendance_type"]),
        ]

    def __str__(self):
        return f"{self.student.name} - {self.clinic} ({self.date}: {self.get_attendance_type_display()})"

    def save(self, *args, **kwargs):
        """
        출석 데이터 저장 시 no_show 카운트 업데이트
        """
        # 기존 데이터인지 확인 (수정인지 새로 생성인지)
        is_update = self.pk is not None
        old_attendance_type = None

        if is_update:
            try:
                old_instance = ClinicAttendance.objects.get(pk=self.pk)
                old_attendance_type = old_instance.attendance_type
            except ClinicAttendance.DoesNotExist:
                is_update = False

        super().save(*args, **kwargs)

        # no_show 카운트 업데이트
        self._update_no_show_count(old_attendance_type)

    def delete(self, *args, **kwargs):
        """
        출석 데이터 삭제 시 no_show 카운트 업데이트
        """
        old_attendance_type = self.attendance_type
        super().delete(*args, **kwargs)

        # no_show 카운트 업데이트 (삭제되는 데이터의 반대 작업)
        self._update_no_show_count_on_delete(old_attendance_type)

    def _update_no_show_count(self, old_attendance_type=None):
        """
        학생의 no_show 카운트를 업데이트하는 헬퍼 메서드
        """
        student = self.student

        # 현재 출석 타입이 무단결석(absent)인 경우 no_show 증가 (+2)
        if self.attendance_type == "absent":
            if old_attendance_type != "absent":  # 새로 무단결석이 된 경우
                student.no_show += 2  # +1에서 +2로 변경

        # 이전에 무단결석이었는데 다른 상태로 변경된 경우 no_show 감소 (-2)
        elif old_attendance_type == "absent":
            student.no_show = max(
                0, student.no_show - 2
            )  # -1에서 -2로 변경하되 0 이하로 내려가지 않도록

        student.save(update_fields=["no_show"])

    def _update_no_show_count_on_delete(self, old_attendance_type):
        """
        출석 데이터 삭제 시 no_show 카운트를 업데이트하는 헬퍼 메서드
        """
        if old_attendance_type == "absent":
            student = self.student
            student.no_show = max(
                0, student.no_show - 2
            )  # -1에서 -2로 변경하되 0 이하로 내려가지 않도록
            student.save(update_fields=["no_show"])


class StudentPlacement(models.Model):
    """학생 배치 모델 - Student 모델 대신 User 모델 사용"""

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="placements",
        limit_choices_to={"is_student": True},
    )  # 학생 사용자 (is_student=True인 User)
    teacher = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="student_placements",
        limit_choices_to={"is_teacher": True},
    )  # 강사 사용자 (is_teacher=True인 User)
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="placements"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student.name} - {self.teacher.name} ({self.subject})"


class LoginHistory(models.Model):
    """로그인 이력 추적 모델"""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="login_history",
        verbose_name="사용자",
    )

    # 네트워크 정보
    ip_address = models.GenericIPAddressField(verbose_name="IP 주소")
    forwarded_ip = models.GenericIPAddressField(
        null=True, blank=True, verbose_name="프록시 IP"
    )

    # 기기/브라우저 정보
    user_agent = models.TextField(verbose_name="User Agent")
    device_type = models.CharField(
        max_length=20, default="unknown", verbose_name="기기 유형"
    )  # desktop, mobile, tablet, unknown
    os_name = models.CharField(
        max_length=50, default="unknown", verbose_name="운영체제"
    )
    browser_name = models.CharField(
        max_length=50, default="unknown", verbose_name="브라우저"
    )

    # 위치 정보 (선택적)
    country = models.CharField(
        max_length=100, null=True, blank=True, verbose_name="국가"
    )
    city = models.CharField(max_length=100, null=True, blank=True, verbose_name="도시")
    isp = models.CharField(max_length=100, null=True, blank=True, verbose_name="ISP")

    # 세션 정보
    session_key = models.CharField(
        max_length=40, null=True, blank=True, verbose_name="세션 키"
    )
    token_key = models.CharField(
        max_length=40, null=True, blank=True, verbose_name="토큰 키"
    )

    # 로그인 결과
    login_success = models.BooleanField(default=True, verbose_name="로그인 성공 여부")
    failure_reason = models.CharField(
        max_length=100, null=True, blank=True, verbose_name="실패 사유"
    )
    logout_reason = models.CharField(
        max_length=50, null=True, blank=True, verbose_name="로그아웃 사유"
    )

    # 타임스탬프
    login_at = models.DateTimeField(auto_now_add=True, verbose_name="로그인 시간")
    logout_at = models.DateTimeField(
        null=True, blank=True, verbose_name="로그아웃 시간"
    )

    # 기존 세션 정보
    previous_session_terminated = models.BooleanField(
        default=False, verbose_name="기존 세션 종료됨"
    )
    previous_login_ip = models.GenericIPAddressField(
        null=True, blank=True, verbose_name="이전 로그인 IP"
    )

    class Meta:
        ordering = ["-login_at"]
        verbose_name = "로그인 이력"
        verbose_name_plural = "로그인 이력"
        indexes = [
            models.Index(fields=["user", "-login_at"]),
            models.Index(fields=["ip_address"]),
            models.Index(fields=["login_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.ip_address} ({self.login_at})"

    @property
    def session_duration(self):
        """세션 지속 시간 계산"""
        if self.logout_at:
            return self.logout_at - self.login_at
        return None

    def get_device_info(self):
        """기기 정보 요약"""
        return f"{self.device_type} - {self.browser_name} on {self.os_name}"


class UserSession(models.Model):
    """사용자 세션 관리 모델 - 중복 로그인 방지용"""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="current_session",
        verbose_name="사용자",
    )
    session_key = models.CharField(
        max_length=40, null=True, blank=True, verbose_name="세션 키"
    )
    token_key = models.CharField(
        max_length=40, null=True, blank=True, verbose_name="토큰 키"
    )

    # 현재 세션의 기기 정보
    current_ip = models.GenericIPAddressField(
        null=True, blank=True, verbose_name="현재 IP"
    )
    current_user_agent = models.TextField(
        null=True, blank=True, verbose_name="현재 User Agent"
    )
    current_device_type = models.CharField(
        max_length=20, null=True, blank=True, verbose_name="현재 기기 유형"
    )

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="생성 시간")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="업데이트 시간")
    last_activity = models.DateTimeField(auto_now=True, verbose_name="마지막 활동")

    class Meta:
        verbose_name = "사용자 세션"
        verbose_name_plural = "사용자 세션"
        indexes = [
            models.Index(fields=["session_key"]),
            models.Index(fields=["token_key"]),
            models.Index(fields=["last_activity"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.current_ip or 'No IP'}"

    def is_active(self):
        """세션이 활성 상태인지 확인"""
        return bool(self.session_key or self.token_key)

    def invalidate(self):
        """세션 무효화"""
        self.session_key = None
        self.token_key = None
        self.save()
