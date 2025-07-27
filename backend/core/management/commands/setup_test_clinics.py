"""
테스트용 클리닉 생성 Django 관리 명령어

월요일에 4개의 시간대에 각각 2개씩 총 8개의 클리닉을 생성합니다.
각 클리닉의 정원은 6명으로 설정하여 테스트에 충분한 수용력을 제공합니다.

실행 방법:
python manage.py setup_test_clinics
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import User, Subject, Clinic


class Command(BaseCommand):
    help = "테스트용 월요일 클리닉들을 생성합니다"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="기존 테스트 클리닉들을 삭제하고 새로 생성",
        )
        parser.add_argument(
            "--capacity",
            type=int,
            default=6,
            help="각 클리닉의 정원 (기본값: 6명)",
        )

    def handle(self, *args, **options):
        reset = options["reset"]
        capacity = options["capacity"]

        self.stdout.write(self.style.SUCCESS("🏗️  테스트용 클리닉 생성을 시작합니다..."))

        try:
            with transaction.atomic():
                # 기존 테스트 클리닉 삭제 (reset 옵션이 있을 때)
                if reset:
                    deleted_count = Clinic.objects.filter(
                        clinic_day="mon", clinic_teacher__name__startswith="테스트강사"
                    ).count()

                    Clinic.objects.filter(
                        clinic_day="mon", clinic_teacher__name__startswith="테스트강사"
                    ).delete()

                    self.stdout.write(
                        self.style.WARNING(
                            f"🗑️  기존 테스트 클리닉 {deleted_count}개 삭제됨"
                        )
                    )

                # 과목 확인 및 생성
                subject, created = Subject.objects.get_or_create(
                    subject="physics1", defaults={"subject_kr": "물리학1"}
                )

                if created:
                    self.stdout.write(
                        self.style.SUCCESS(f"📚 과목 생성: {subject.subject}")
                    )

                # 테스트 강사 계정들 생성
                teachers = []
                for i in range(1, 9):  # 8명의 테스트 강사
                    teacher, created = User.objects.get_or_create(
                        username=f"test_teacher_{i:02d}",
                        defaults={
                            "name": f"테스트강사{i:02d}",
                            "is_teacher": True,
                            "is_student": False,
                            "subject": subject,
                            "phone_num": f"010-9999-{i:04d}",
                        },
                    )

                    # 비밀번호 설정 (새로 생성된 경우만)
                    if created:
                        teacher.set_password("testpass123")
                        teacher.save()
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"👨‍🏫 강사 계정 생성: {teacher.username}"
                            )
                        )

                    teachers.append(teacher)

                # 시간대 정의
                time_slots = ["18:00", "19:00", "20:00", "21:00"]
                rooms = [
                    "1강의실",
                    "2강의실",
                    "3강의실",
                    "4강의실",
                    "5강의실",
                    "6강의실",
                    "7강의실",
                    "8강의실",
                ]

                clinic_count = 0

                # 각 시간대마다 2개의 클리닉 생성 (총 8개)
                for i, time_slot in enumerate(time_slots):
                    for j in range(2):  # 각 시간대당 2개
                        room = rooms[i * 2 + j]  # 시간대별로 다른 강의실 할당
                        teacher = teachers[i * 2 + j]  # 시간대별로 다른 강사 할당

                        clinic, created = Clinic.objects.get_or_create(
                            clinic_day="mon",
                            clinic_time=time_slot,
                            clinic_room=room,
                            defaults={
                                "clinic_teacher": teacher,
                                "clinic_subject": subject,
                                "clinic_capacity": capacity,
                                "is_active": True,  # 예약 가능하도록 활성화
                            },
                        )

                        if created:
                            clinic_count += 1
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f"🏥 클리닉 생성: {time_slot} - {room} ({teacher.name}) - 정원 {capacity}명"
                                )
                            )
                        else:
                            # 기존 클리닉이 있다면 활성화 상태 업데이트
                            if not clinic.is_active:
                                clinic.is_active = True
                                clinic.save()
                                self.stdout.write(
                                    self.style.WARNING(
                                        f"🔄 기존 클리닉 활성화: {time_slot} - {room}"
                                    )
                                )

                self.stdout.write("")
                self.stdout.write(self.style.SUCCESS(f"✅ 테스트용 클리닉 생성 완료!"))
                self.stdout.write(
                    self.style.SUCCESS(f"📊 생성된 클리닉: {clinic_count}개")
                )
                self.stdout.write(
                    self.style.SUCCESS(f"👥 각 클리닉 정원: {capacity}명")
                )
                self.stdout.write(
                    self.style.SUCCESS(f"🎯 총 수용 인원: {clinic_count * capacity}명")
                )
                self.stdout.write("")

                # 생성된 클리닉 현황 출력
                self.stdout.write(self.style.HTTP_INFO("📋 생성된 월요일 클리닉 현황:"))

                monday_clinics = Clinic.objects.filter(
                    clinic_day="mon", is_active=True
                ).order_by("clinic_time", "clinic_room")

                for clinic in monday_clinics:
                    status = "🟢 활성" if clinic.is_active else "🔴 비활성"
                    self.stdout.write(
                        f"  • {clinic.clinic_time} - {clinic.clinic_room} "
                        f"({clinic.clinic_teacher.name}) - "
                        f"{clinic.get_current_students_count()}/{clinic.clinic_capacity} {status}"
                    )

                self.stdout.write("")
                self.stdout.write(
                    self.style.SUCCESS(
                        "🚀 이제 다음 명령어로 부하 테스트를 실행할 수 있습니다:"
                    )
                )
                self.stdout.write(
                    self.style.HTTP_INFO(
                        "python backend/scripts/clinic_reservation_stress_test.py"
                    )
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ 클리닉 생성 중 오류 발생: {str(e)}")
            )
            import traceback

            self.stdout.write(self.style.ERROR(traceback.format_exc()))
