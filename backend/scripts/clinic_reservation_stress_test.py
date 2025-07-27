#!/usr/bin/env python3
"""
보충 예약 시스템 부하 테스트 스크립트

20명의 학생이 동시에 월요일 클리닉들에 무작위로 예약을 시도하는 테스트
실제 사용 상황과 유사한 동시성을 시뮬레이션합니다.

실행 방법:
1. 백엔드 서버가 실행 중인지 확인
2. python backend/scripts/clinic_reservation_stress_test.py

"""

import asyncio
import aiohttp
import random
import json
import time
from typing import List, Dict, Any
import logging
from datetime import datetime

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("clinic_test.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# 테스트 설정
BASE_URL = "http://localhost:8000/api"  # 백엔드 API URL
NUM_STUDENTS = 20  # 테스트할 학생 수
TARGET_DAY = "mon"  # 테스트할 요일 (월요일)


class ClinicReservationTester:
    def __init__(self):
        self.session = None
        self.students = []  # 학생 정보 저장
        self.tokens = {}  # 학생별 토큰 저장
        self.monday_clinics = []  # 월요일 클리닉 정보

    async def __aenter__(self):
        """비동기 컨텍스트 매니저 시작"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=50, limit_per_host=30),
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """비동기 컨텍스트 매니저 종료"""
        if self.session:
            await self.session.close()

    async def create_test_students(self):
        """테스트용 학생 계정 20개 생성"""
        logger.info("🏗️  테스트 학생 계정들을 생성하는 중...")

        created_count = 0
        existing_count = 0

        for i in range(1, NUM_STUDENTS + 1):
            student_data = {
                "username": f"test_student_{i:02d}",
                "password": "testpass123",
                "name": f"테스트학생{i:02d}",
                "phone_num": f"010-1234-{i:04d}",
                "student_phone_num": f"010-1234-{i:04d}",
                "student_parent_phone_num": f"010-5678-{i:04d}",
                "school": "세화고",
                "grade": "2학년",
                "subject": 1,  # physics1 과목 ID
                "is_student": True,
                "is_teacher": False,
            }

            try:
                async with self.session.post(
                    f"{BASE_URL}/auth/register/",
                    json=student_data,
                    headers={"Content-Type": "application/json"},
                ) as response:
                    if response.status == 201:
                        result = await response.json()
                        self.students.append(
                            {
                                "id": result.get("id"),
                                "username": student_data["username"],
                                "password": student_data["password"],
                                "name": student_data["name"],
                            }
                        )
                        created_count += 1
                        logger.info(f"✅ 학생 계정 생성: {student_data['username']}")
                    elif response.status == 400:
                        # 이미 존재하는 계정 - 로그인으로 확인
                        self.students.append(
                            {
                                "username": student_data["username"],
                                "password": student_data["password"],
                                "name": student_data["name"],
                            }
                        )
                        existing_count += 1
                        logger.info(
                            f"♻️  기존 학생 계정 사용: {student_data['username']}"
                        )
                    else:
                        error_text = await response.text()
                        logger.error(
                            f"❌ 학생 계정 생성 실패: {student_data['username']} - {error_text}"
                        )

            except Exception as e:
                logger.error(
                    f"❌ 학생 계정 생성 중 오류: {student_data['username']} - {str(e)}"
                )

        logger.info(
            f"📊 학생 계정 준비 완료 - 생성: {created_count}개, 기존: {existing_count}개, 총: {len(self.students)}개"
        )

    async def login_student(self, student: Dict[str, str]) -> bool:
        """학생 로그인 및 토큰 획득"""
        try:
            login_data = {
                "username": student["username"],
                "password": student["password"],
            }

            async with self.session.post(
                f"{BASE_URL}/auth/login/",
                json=login_data,
                headers={"Content-Type": "application/json"},
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    token = result.get("token")
                    if token:
                        self.tokens[student["username"]] = token
                        # student 정보에 id 추가 (로그인 응답에서 받아옴)
                        if "id" not in student:
                            student["id"] = result.get("user", {}).get("id")
                        logger.debug(f"🔑 로그인 성공: {student['username']}")
                        return True
                    else:
                        logger.error(f"❌ 토큰 없음: {student['username']}")
                        return False
                else:
                    error_text = await response.text()
                    logger.error(
                        f"❌ 로그인 실패: {student['username']} - {error_text}"
                    )
                    return False

        except Exception as e:
            logger.error(f"❌ 로그인 중 오류: {student['username']} - {str(e)}")
            return False

    async def login_all_students(self):
        """모든 학생들 동시 로그인"""
        logger.info("🔐 모든 학생들이 로그인하는 중...")

        login_tasks = [self.login_student(student) for student in self.students]
        results = await asyncio.gather(*login_tasks, return_exceptions=True)

        successful_logins = sum(1 for result in results if result is True)
        logger.info(
            f"📊 로그인 완료 - 성공: {successful_logins}명 / 총: {len(self.students)}명"
        )

    async def get_weekly_schedule(self) -> Dict[str, Any]:
        """주간 스케줄 조회 (첫 번째 학생의 토큰 사용)"""
        if not self.tokens:
            logger.error("❌ 로그인된 학생이 없습니다")
            return {}

        try:
            # 첫 번째 로그인된 학생의 토큰 사용
            first_token = list(self.tokens.values())[0]

            async with self.session.get(
                f"{BASE_URL}/clinics/weekly-schedule/",
                headers={
                    "Authorization": f"Token {first_token}",
                    "Content-Type": "application/json",
                },
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info("📅 주간 스케줄 조회 성공")
                    return result
                else:
                    error_text = await response.text()
                    logger.error(f"❌ 스케줄 조회 실패: {error_text}")
                    return {}

        except Exception as e:
            logger.error(f"❌ 스케줄 조회 중 오류: {str(e)}")
            return {}

    def extract_monday_clinics(self, schedule_data: Dict[str, Any]):
        """월요일 클리닉들 추출"""
        schedule = schedule_data.get("schedule", {})
        monday_schedule = schedule.get(TARGET_DAY, {})

        self.monday_clinics = []
        for time, clinic_info in monday_schedule.items():
            if clinic_info.get("clinic_id"):  # 실제 클리닉이 있는 경우만
                self.monday_clinics.append(
                    {
                        "clinic_id": clinic_info["clinic_id"],
                        "time": time,
                        "teacher_name": clinic_info["teacher_name"],
                        "subject": clinic_info["subject"],
                        "room": clinic_info["room"],
                        "capacity": clinic_info["capacity"],
                        "current_count": clinic_info["current_count"],
                        "remaining_spots": clinic_info["remaining_spots"],
                        "is_full": clinic_info["is_full"],
                    }
                )

        logger.info(f"📋 월요일 클리닉 {len(self.monday_clinics)}개 발견")
        for clinic in self.monday_clinics:
            logger.info(
                f"  • {clinic['time']} - {clinic['subject']} ({clinic['room']}) - {clinic['current_count']}/{clinic['capacity']}"
            )

    async def reserve_clinic(
        self, student: Dict[str, str], clinic: Dict[str, Any]
    ) -> Dict[str, Any]:
        """개별 클리닉 예약 시도"""
        username = student["username"]
        token = self.tokens.get(username)

        if not token:
            return {
                "success": False,
                "error": "토큰 없음",
                "student": username,
                "clinic_id": clinic["clinic_id"],
            }

        try:
            reservation_data = {
                "user_id": student["id"],
                "clinic_id": clinic["clinic_id"],
            }

            start_time = time.time()
            async with self.session.post(
                f"{BASE_URL}/clinics/reserve/",
                json=reservation_data,
                headers={
                    "Authorization": f"Token {token}",
                    "Content-Type": "application/json",
                },
            ) as response:
                end_time = time.time()
                response_time = (end_time - start_time) * 1000  # ms 단위

                result = await response.json()

                return {
                    "success": response.status == 200,
                    "status_code": response.status,
                    "response_time": response_time,
                    "student": username,
                    "clinic_id": clinic["clinic_id"],
                    "clinic_info": f"{clinic['time']} {clinic['room']}",
                    "message": result.get("message", ""),
                    "error": result.get("error", ""),
                    "raw_response": result,
                }

        except Exception as e:
            return {
                "success": False,
                "error": f"네트워크 오류: {str(e)}",
                "student": username,
                "clinic_id": clinic["clinic_id"],
                "response_time": 0,
            }

    async def student_reservation_session(
        self, student: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """개별 학생의 예약 세션 (무작위 개수의 클리닉 예약 시도)"""
        if not self.monday_clinics:
            return []

        # 각 학생마다 1~5개의 무작위 클리닉 선택
        num_reservations = random.randint(1, min(5, len(self.monday_clinics)))
        selected_clinics = random.sample(self.monday_clinics, num_reservations)

        logger.info(f"👤 {student['username']}: {num_reservations}개 클리닉 예약 시도")

        # 각 예약 시도 사이에 0.1~2초 랜덤 딜레이 (실제 사용자 행동 시뮬레이션)
        results = []
        for i, clinic in enumerate(selected_clinics):
            if i > 0:  # 첫 번째 예약이 아닌 경우 딜레이
                delay = random.uniform(0.1, 2.0)
                await asyncio.sleep(delay)

            result = await self.reserve_clinic(student, clinic)
            results.append(result)

            # 결과 로깅
            if result["success"]:
                logger.info(
                    f"  ✅ {student['username']}: {result['clinic_info']} 예약 성공 ({result['response_time']:.1f}ms)"
                )
            else:
                logger.info(
                    f"  ❌ {student['username']}: {result['clinic_info']} 예약 실패 - {result['error']} ({result.get('response_time', 0):.1f}ms)"
                )

        return results

    async def run_concurrent_reservations(self):
        """모든 학생들의 동시 예약 시도"""
        logger.info("🚀 동시 예약 테스트 시작!")
        logger.info(
            f"📊 참가자: {len([s for s in self.students if s['username'] in self.tokens])}명"
        )

        # 로그인된 학생들만 필터링
        logged_in_students = [s for s in self.students if s["username"] in self.tokens]

        if not logged_in_students:
            logger.error("❌ 로그인된 학생이 없습니다")
            return

        # 모든 학생의 예약 세션을 동시에 실행
        start_time = datetime.now()
        tasks = [
            self.student_reservation_session(student) for student in logged_in_students
        ]
        all_results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = datetime.now()

        # 결과 집계
        total_attempts = 0
        successful_reservations = 0
        failed_reservations = 0
        response_times = []
        error_types = {}

        for student_results in all_results:
            if isinstance(student_results, Exception):
                logger.error(f"❌ 학생 세션 오류: {str(student_results)}")
                continue

            for result in student_results:
                total_attempts += 1
                if result["success"]:
                    successful_reservations += 1
                else:
                    failed_reservations += 1
                    error_type = result.get("error", "알 수 없는 오류")
                    error_types[error_type] = error_types.get(error_type, 0) + 1

                if result.get("response_time", 0) > 0:
                    response_times.append(result["response_time"])

        # 최종 스케줄 다시 조회하여 결과 확인
        final_schedule = await self.get_weekly_schedule()
        if final_schedule:
            self.extract_monday_clinics(final_schedule)

        # 결과 리포트
        duration = (end_time - start_time).total_seconds()
        avg_response_time = (
            sum(response_times) / len(response_times) if response_times else 0
        )

        logger.info("=" * 60)
        logger.info("🎯 테스트 결과 요약")
        logger.info("=" * 60)
        logger.info(f"⏱️  총 소요 시간: {duration:.2f}초")
        logger.info(f"👥 참가 학생 수: {len(logged_in_students)}명")
        logger.info(f"📊 총 예약 시도: {total_attempts}회")
        logger.info(f"✅ 성공한 예약: {successful_reservations}회")
        logger.info(f"❌ 실패한 예약: {failed_reservations}회")
        logger.info(
            f"📈 성공률: {(successful_reservations/total_attempts*100):.1f}%"
            if total_attempts > 0
            else "📈 성공률: 0%"
        )
        logger.info(f"⚡ 평균 응답시간: {avg_response_time:.1f}ms")

        if error_types:
            logger.info("🔍 실패 원인 분석:")
            for error, count in sorted(
                error_types.items(), key=lambda x: x[1], reverse=True
            ):
                logger.info(f"  • {error}: {count}회")

        logger.info("📋 최종 월요일 클리닉 현황:")
        for clinic in self.monday_clinics:
            status = (
                "🔴 마감"
                if clinic["is_full"]
                else f"🟢 {clinic['remaining_spots']}자리"
            )
            logger.info(
                f"  • {clinic['time']} - {clinic['subject']} ({clinic['room']}) - {clinic['current_count']}/{clinic['capacity']} {status}"
            )

        logger.info("=" * 60)

    async def run_test(self):
        """전체 테스트 실행"""
        logger.info("🎪 보충 예약 시스템 부하 테스트 시작")
        logger.info(
            f"🎯 목표: {NUM_STUDENTS}명 학생이 {TARGET_DAY}요일 클리닉에 동시 예약"
        )
        logger.info("-" * 60)

        try:
            # 1. 테스트 학생 계정 생성
            await self.create_test_students()

            # 2. 모든 학생 로그인
            await self.login_all_students()

            # 3. 주간 스케줄 조회
            schedule_data = await self.get_weekly_schedule()
            if not schedule_data:
                logger.error("❌ 스케줄 조회 실패, 테스트 중단")
                return

            # 4. 월요일 클리닉 추출
            self.extract_monday_clinics(schedule_data)
            if not self.monday_clinics:
                logger.error(f"❌ {TARGET_DAY}요일에 예약 가능한 클리닉이 없습니다")
                return

            # 5. 동시 예약 테스트 실행
            await self.run_concurrent_reservations()

        except Exception as e:
            logger.error(f"❌ 테스트 중 치명적 오류: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())


async def main():
    """메인 실행 함수"""
    async with ClinicReservationTester() as tester:
        await tester.run_test()


if __name__ == "__main__":
    # Windows 환경에서의 이벤트 루프 정책 설정
    import sys

    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    # 테스트 실행
    asyncio.run(main())
