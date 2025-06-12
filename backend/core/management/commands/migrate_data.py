from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import (
    User as OldUser,
    Student as OldStudent,
    Subject as OldSubject,
    Time as OldTime,
    Clinic as OldClinic,
    Comment as OldComment,
)
from core.models import User, Student, Subject, Time, Clinic, Comment


class Command(BaseCommand):
    help = "기존 모델의 데이터를 새 모델로 마이그레이션합니다."

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("데이터 마이그레이션을 시작합니다...")

        # Subject 마이그레이션
        self.stdout.write("과목 데이터 마이그레이션 중...")
        for old_subject in OldSubject.objects.all():
            Subject.objects.create(
                id=old_subject.id,
                subject=old_subject.subject,
                subject_kr=old_subject.subject_kr,
            )

        # Time 마이그레이션
        self.stdout.write("시간 데이터 마이그레이션 중...")
        for old_time in OldTime.objects.all():
            Time.objects.create(
                id=old_time.id, time_day=old_time.time_day, time_slot=old_time.time_slot
            )

        # User 마이그레이션
        self.stdout.write("사용자 데이터 마이그레이션 중...")
        for old_user in OldUser.objects.all():
            user = User.objects.create(
                id=old_user.id,
                username=old_user.username,
                password=old_user.password,  # 해시된 비밀번호 그대로 복사
                email=old_user.email,
                first_name=old_user.first_name,
                last_name=old_user.last_name,
                is_active=old_user.is_active,
                is_staff=old_user.is_staff,
                is_superuser=old_user.is_superuser,
                date_joined=old_user.date_joined,
                user_name=old_user.user_name,
                user_phone_num=old_user.user_phone_num,
                user_subject_id=(
                    old_user.user_subject_id if old_user.user_subject else None
                ),
                is_teacher=old_user.is_teacher,
            )
            # M2M available_time 필드 제거됨 - 클리닉 생성 에러 해결을 위해

        # Student 마이그레이션
        self.stdout.write("학생 데이터 마이그레이션 중...")
        for old_student in OldStudent.objects.all():
            student = Student.objects.create(
                id=old_student.id,
                student_name=old_student.student_name,
                student_phone_num=old_student.student_phone_num,
                student_parent_phone_num=old_student.student_parent_phone_num,
                school=old_student.school,
                grade=old_student.grade,
                student_subject_id=(
                    old_student.student_subject_id
                    if old_student.student_subject
                    else None
                ),
                assigned_teacher_id=(
                    old_student.assigned_teacher_id
                    if old_student.assigned_teacher
                    else None
                ),
            )
            # M2M available_time 필드 제거됨 - 클리닉 생성 에러 해결을 위해

        # Clinic 마이그레이션
        self.stdout.write("클리닉 데이터 마이그레이션 중...")
        for old_clinic in OldClinic.objects.all():
            clinic = Clinic.objects.create(
                id=old_clinic.id,
                clinic_teacher_id=old_clinic.clinic_teacher_id,
                clinic_time_id=old_clinic.clinic_time_id,
                clinic_subject_id=old_clinic.clinic_subject_id,
            )
            # M2M 필드 복사
            for student in old_clinic.clinic_students.all():
                clinic.clinic_students.add(Student.objects.get(id=student.id))

        # Comment 마이그레이션
        self.stdout.write("코멘트 데이터 마이그레이션 중...")
        for old_comment in OldComment.objects.all():
            Comment.objects.create(
                id=old_comment.id,
                comment_author_id=old_comment.comment_author_id,
                comment_student_id=old_comment.comment_student_id,
                comment_text=old_comment.comment_text,
                created_at=old_comment.created_at,
            )

        self.stdout.write(self.style.SUCCESS("데이터 마이그레이션이 완료되었습니다!"))
