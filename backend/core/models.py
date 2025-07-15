"""
이 파일은 시스템의 핵심 데이터 모델을 정의합니다.
User, Subject, Time, Student, Clinic, Comment 등의 기본 모델을 포함하며,
시스템 전체에서 사용되는 데이터 구조를 담당합니다.
"""

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings


class Subject(models.Model):
    """과목 모델"""

    subject = models.CharField(max_length=50)  # 과목명
    subject_kr = models.CharField(max_length=50, default="한글과목명")  # 과목명 한글

    def __str__(self):
        return self.subject


# Time 모델 주석처리 - 보충 시스템 개편으로 고정 시간 사용
# class Time(models.Model):
#     """시간 모델"""
#
#     DAY_CHOICES = (
#         ("mon", "월요일"),
#         ("tue", "화요일"),
#         ("wed", "수요일"),
#         ("thu", "목요일"),
#         ("fri", "금요일"),
#         ("sat", "토요일"),
#         ("sun", "일요일"),
#     )
#
#     time_day = models.CharField(max_length=3, choices=DAY_CHOICES)  # 요일
#     time_slot = models.TimeField()  # 시간
#
#     def __str__(self):
#         return f"{self.get_time_day_display()} {self.time_slot.strftime('%H:%M')}"


class User(AbstractUser):
    """사용자 모델"""

    user_name = models.CharField(max_length=100)  # 사용자 이름
    user_phone_num = models.CharField(
        max_length=15, default="000-0000-0000"
    )  # 전화번호
    user_subject = models.ForeignKey(
        Subject,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="teachers",
    )  # 담당 과목
    is_teacher = models.BooleanField(default=True)
    max_student_num = models.IntegerField(default=100)
    # available_time = models.ManyToManyField(
    #     Time,
    #     blank=True,
    #     related_name="teachers_available_time",
    # )  # 선생님이 수업 가능한 시간대들 (복수 선택 가능) - 보충 시스템 개편으로 주석처리

    def __str__(self):
        return self.user_name

    def save(self, *args, **kwargs):
        """
        권한 계층 유지:
        - 슈퍼유저는 관리자 이상의 권한을 가짐
        - 관리자는 강사 이상의 권한을 가짐
        """
        if self.is_superuser:
            self.is_staff = True

        if self.is_staff:
            self.is_teacher = True

        super().save(*args, **kwargs)


class Student(models.Model):
    """학생 모델"""

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

    student_name = models.CharField(max_length=100)  # 학생 이름
    student_phone_num = models.CharField(max_length=15)  # 학생 전화번호
    student_parent_phone_num = models.CharField(max_length=15)  # 학부모 전화번호
    school = models.CharField(
        max_length=100, choices=SCHOOL_CHOICES, default="세화고"
    )  # 학교
    grade = models.CharField(
        max_length=10, choices=GRADE_CHOICES, default="1학년"
    )  # 학년
    student_subject = models.ForeignKey(
        Subject,
        on_delete=models.SET_NULL,
        null=True,
        related_name="students",
        default="physics1",
    )  # 수강 과목
    # expected_teacher = models.CharField(max_length=100, default="")  # 보충 시스템 개편으로 주석처리
    # assigned_teacher = models.ForeignKey(
    #     User,
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name="assigned_students",
    # )  # 담당 강사 - 보충 시스템 개편으로 주석처리
    # clinic_attended_dates = models.JSONField(
    #     default=list, blank=True
    # )  # 클리닉 출석 기록 (날짜와 시간 정보를 JSON 배열로 저장) - 보충 시스템 개편으로 주석처리
    # available_time = models.ManyToManyField(
    #     Time,
    #     blank=True,
    #     related_name="students_available_time",
    # )  # 학생이 수업 가능한 시간대들 (복수 선택 가능) - 보충 시스템 개편으로 주석처리
    reserved_clinic = models.ManyToManyField(
        "Clinic",
        blank=True,
        related_name="reserved_students",
    )  # 학생이 예약한 클리닉들 (prime clinic, sub clinic 구분)

    def __str__(self):
        return self.student_name


class Clinic(models.Model):
    """클리닉 예약 모델 - 보충 시스템 개편"""

    DAY_CHOICES = (
        ("mon", "월요일"),
        ("tue", "화요일"),
        ("wed", "수요일"),
        ("thu", "목요일"),
        ("fri", "금요일"),
        ("sat", "토요일"),
        ("sun", "일요일"),
    )

    clinic_teacher = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="assigned_clinics"
    )  # 담당 강사
    clinic_prime_students = models.ManyToManyField(
        Student, blank=True, related_name="enrolled_prime_clinics"
    )  # Prime clinic 등록 학생들 (18:00-19:00 담당 선생 수업)
    clinic_sub_students = models.ManyToManyField(
        Student, blank=True, related_name="enrolled_sub_clinics"
    )  # Sub clinic 등록 학생들 (19:00-22:00 자유 질문)
    clinic_unassigned_students = models.ManyToManyField(
        Student, blank=True, related_name="unassigned_clinics"
    )  # Prime or Sub 아닌 학생들 (웹에서 직접 등록할 때 필요한 영역)
    clinic_day = models.CharField(
        max_length=3, choices=DAY_CHOICES, default="mon"
    )  # 클리닉 요일
    clinic_subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="related_clinics",
        default="physics1",
    )  # 클리닉 과목

    def __str__(self):
        return f"{self.clinic_subject} - {self.get_clinic_day_display()}"


# Comment 모델 주석처리 - 보충 시스템 개편으로 불필요
# class Comment(models.Model):
#     """코멘트 모델"""
#
#     comment_author = models.ForeignKey(
#         User, on_delete=models.CASCADE, related_name="authored_comments"
#     )  # 작성자
#     comment_student = models.ForeignKey(
#         Student, on_delete=models.CASCADE, related_name="received_comments"
#     )  # 대상 학생
#     comment_text = models.TextField()  # 코멘트 내용
#     created_at = models.DateTimeField(auto_now_add=True)  # 작성 시간
#
#     def __str__(self):
#         return f"{self.comment_author} -> {self.comment_student}"


class StudentPlacement(models.Model):
    """학생 배치 모델"""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="placements"
    )
    teacher = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="student_placements"
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="placements"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student} - {self.teacher} ({self.subject})"
