"""
테스트용 학생 계정 생성 Django 관리 명령어

20명의 테스트 학생 계정을 생성하거나 기존 계정의 비밀번호를 초기화합니다.
모든 계정의 비밀번호는 'testpass123'으로 설정됩니다.

실행 방법:
python manage.py setup_test_students
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import User, Subject


class Command(BaseCommand):
    help = "테스트용 학생 계정 20개를 생성합니다"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="기존 테스트 학생 계정들의 비밀번호를 초기화",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=20,
            help="생성할 학생 계정 수 (기본값: 20명)",
        )

    def handle(self, *args, **options):
        reset_passwords = options["reset_passwords"]
        student_count = options["count"]

        self.stdout.write(
            self.style.SUCCESS("👥 테스트 학생 계정 생성을 시작합니다...")
        )

        try:
            with transaction.atomic():
                # 과목 확인 및 생성 (물리학1 기본값)
                subject, created = Subject.objects.get_or_create(
                    subject="physics1", defaults={"subject_kr": "물리학1"}
                )

                if created:
                    self.stdout.write(
                        self.style.SUCCESS(f"📚 과목 생성: {subject.subject}")
                    )

                created_count = 0
                updated_count = 0

                for i in range(1, student_count + 1):
                    username = f"test_student_{i:02d}"

                    # 학생 계정 생성 또는 업데이트
                    student, created = User.objects.get_or_create(
                        username=username,
                        defaults={
                            "name": f"테스트학생{i:02d}",
                            "phone_num": f"010-1234-{i:04d}",
                            "student_phone_num": f"010-1234-{i:04d}",
                            "student_parent_phone_num": f"010-5678-{i:04d}",
                            "school": "세화고",
                            "grade": "2학년",
                            "subject": subject,
                            "is_student": True,
                            "is_teacher": False,
                            "is_staff": False,
                            "is_superuser": False,
                            "email": f"{username}@test.com",
                            "no_show": 0,  # 노쇼 횟수 초기화
                        },
                    )

                    if created:
                        # 새로 생성된 계정
                        student.set_password("testpass123")
                        student.save()
                        created_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(f"✅ 학생 계정 생성: {username}")
                        )
                    elif reset_passwords:
                        # 기존 계정의 비밀번호 초기화
                        student.set_password("testpass123")
                        student.is_student = True  # 학생 권한 확인
                        student.is_teacher = False
                        student.no_show = 0  # 노쇼 횟수 초기화
                        student.save()
                        updated_count += 1
                        self.stdout.write(
                            self.style.WARNING(f"🔄 비밀번호 초기화: {username}")
                        )
                    else:
                        # 기존 계정은 건드리지 않음
                        self.stdout.write(
                            self.style.HTTP_INFO(f"♻️  기존 계정 유지: {username}")
                        )

                self.stdout.write("")
                self.stdout.write(self.style.SUCCESS(f"✅ 테스트 학생 계정 준비 완료!"))

                if created_count > 0:
                    self.stdout.write(
                        self.style.SUCCESS(f"📊 새로 생성된 계정: {created_count}개")
                    )

                if updated_count > 0:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"🔄 비밀번호 초기화된 계정: {updated_count}개"
                        )
                    )

                total_test_students = User.objects.filter(
                    username__startswith="test_student_", is_student=True
                ).count()

                self.stdout.write(
                    self.style.SUCCESS(
                        f"👥 총 테스트 학생 계정: {total_test_students}개"
                    )
                )

                self.stdout.write("")
                self.stdout.write(
                    self.style.HTTP_INFO("📋 생성된 테스트 학생 계정 정보:")
                )
                self.stdout.write(
                    self.style.HTTP_INFO(
                        "   • 사용자명: test_student_01 ~ test_student_20"
                    )
                )
                self.stdout.write(self.style.HTTP_INFO("   • 비밀번호: testpass123"))
                self.stdout.write(self.style.HTTP_INFO("   • 학교: 세화고"))
                self.stdout.write(self.style.HTTP_INFO("   • 학년: 2학년"))
                self.stdout.write(self.style.HTTP_INFO("   • 과목: 물리학1"))

                self.stdout.write("")
                self.stdout.write(
                    self.style.SUCCESS("🚀 이제 부하 테스트를 실행할 수 있습니다:")
                )
                self.stdout.write(
                    self.style.HTTP_INFO(
                        "python backend/scripts/clinic_reservation_stress_test.py"
                    )
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ 학생 계정 생성 중 오류 발생: {str(e)}")
            )
            import traceback

            self.stdout.write(self.style.ERROR(traceback.format_exc()))
