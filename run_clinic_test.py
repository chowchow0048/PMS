#!/usr/bin/env python3
"""
보충 예약 시스템 종합 테스트 실행 스크립트

이 스크립트는 다음 작업을 자동으로 수행합니다:
1. 필요한 패키지 설치 확인
2. Django 백엔드에서 테스트용 클리닉 생성
3. 20명 학생의 동시 예약 부하 테스트 실행
4. 결과 분석 및 리포트 생성

실행 방법:
python run_clinic_test.py

요구사항:
- Django 백엔드 서버가 http://localhost:8000 에서 실행 중이어야 함
- PostgreSQL 데이터베이스가 연결되어 있어야 함
"""

import subprocess
import sys
import os
import time
from pathlib import Path


def print_header(title):
    """헤더 출력"""
    print("=" * 70)
    print(f"🎯 {title}")
    print("=" * 70)


def print_step(step_num, description):
    """단계별 진행상황 출력"""
    print(f"\n🔸 단계 {step_num}: {description}")
    print("-" * 50)


def check_requirements():
    """필요한 패키지 설치 확인"""
    print_step(1, "필요한 패키지 설치 확인")

    required_packages = ["aiohttp", "asyncio"]
    missing_packages = []

    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package} 설치됨")
        except ImportError:
            missing_packages.append(package)
            print(f"❌ {package} 설치 필요")

    if missing_packages:
        print(f"\n📦 누락된 패키지를 설치합니다: {', '.join(missing_packages)}")
        try:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "aiohttp>=3.8.0"], check=True
            )
            print("✅ 패키지 설치 완료")
        except subprocess.CalledProcessError:
            print("❌ 패키지 설치 실패")
            return False

    return True


def check_server():
    """백엔드 서버 실행 상태 확인"""
    print_step(2, "백엔드 서버 연결 확인")

    try:
        import requests

        response = requests.get("http://localhost:8000/api/health/", timeout=5)
        if response.status_code == 200:
            print("✅ 백엔드 서버 연결 성공")
            return True
        else:
            print(f"❌ 백엔드 서버 응답 오류: {response.status_code}")
            return False
    except ImportError:
        print("⚠️  requests 패키지가 없어서 서버 확인을 건너뜁니다")
        return True
    except Exception as e:
        print(f"❌ 백엔드 서버 연결 실패: {str(e)}")
        print("💡 다음 사항을 확인해주세요:")
        print("   - Django 서버가 http://localhost:8000 에서 실행 중인지 확인")
        print("   - 가상환경이 활성화되어 있는지 확인")
        print("   - 데이터베이스 연결이 정상인지 확인")
        return False


def setup_test_clinics():
    """테스트용 클리닉 생성"""
    print_step(3, "테스트용 클리닉 생성")

    backend_dir = Path("backend")
    if not backend_dir.exists():
        print("❌ backend 디렉토리를 찾을 수 없습니다")
        return False

    # Django 관리 명령어 실행
    try:
        result = subprocess.run(
            [sys.executable, "manage.py", "setup_test_clinics", "--reset"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

        if result.returncode == 0:
            print("✅ 테스트용 클리닉 생성 완료")
            print("📋 생성 결과:")
            # Django 명령어 출력에서 이모지가 포함된 결과 출력
            for line in result.stdout.split("\n"):
                if line.strip() and (
                    "✅" in line
                    or "🏥" in line
                    or "📊" in line
                    or "👥" in line
                    or "🎯" in line
                ):
                    print(f"   {line}")
            return True
        else:
            print(f"❌ 클리닉 생성 실패:")
            print(result.stderr)
            return False

    except Exception as e:
        print(f"❌ 클리닉 생성 중 오류: {str(e)}")
        return False


def run_stress_test():
    """부하 테스트 실행"""
    print_step(4, "20명 학생 동시 예약 부하 테스트 시작")

    test_script = Path("backend/scripts/clinic_reservation_stress_test.py")
    if not test_script.exists():
        print("❌ 테스트 스크립트를 찾을 수 없습니다")
        return False

    print("🚀 부하 테스트를 시작합니다...")
    print("⏱️  예상 소요 시간: 2-3분")
    print("")

    try:
        # 테스트 스크립트 실행
        result = subprocess.run(
            [sys.executable, str(test_script)], text=True, encoding="utf-8"
        )

        if result.returncode == 0:
            print("\n✅ 부하 테스트 완료")
            return True
        else:
            print(f"\n❌ 부하 테스트 실행 중 오류 발생")
            return False

    except KeyboardInterrupt:
        print("\n⏹️  사용자에 의해 테스트가 중단되었습니다")
        return False
    except Exception as e:
        print(f"\n❌ 테스트 실행 중 오류: {str(e)}")
        return False


def show_results():
    """결과 확인 및 분석"""
    print_step(5, "테스트 결과 확인")

    log_file = Path("clinic_test.log")
    if log_file.exists():
        print("📊 상세한 테스트 로그가 clinic_test.log 파일에 저장되었습니다")

        # 로그 파일에서 요약 정보 추출
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                log_content = f.read()

            # 테스트 결과 요약 부분 추출
            if "🎯 테스트 결과 요약" in log_content:
                summary_start = log_content.find("🎯 테스트 결과 요약")
                summary_end = log_content.find("=" * 60, summary_start + 1)
                if summary_end != -1:
                    summary = log_content[summary_start:summary_end]
                    print("\n📋 테스트 결과 요약:")
                    print(summary)

        except Exception as e:
            print(f"⚠️  로그 파일 분석 중 오류: {str(e)}")
    else:
        print("⚠️  테스트 로그 파일을 찾을 수 없습니다")


def main():
    """메인 실행 함수"""
    print_header("보충 예약 시스템 종합 부하 테스트")

    print("🎪 이 테스트는 다음을 시뮬레이션합니다:")
    print("   • 20명의 학생이 동시에 로그인")
    print("   • 각 학생마다 1~5개의 무작위 클리닉 예약 시도")
    print("   • 실제 사용자와 유사한 랜덤 딜레이 포함")
    print("   • 동시성 및 경합 상황 테스트")
    print("")

    # 실행 전 확인
    response = input("🤔 테스트를 시작하시겠습니까? (y/N): ")
    if response.lower() not in ["y", "yes", "예"]:
        print("❌ 테스트가 취소되었습니다")
        return

    start_time = time.time()

    # 단계별 실행
    if not check_requirements():
        print("❌ 요구사항 확인 실패")
        return

    if not check_server():
        print("❌ 서버 연결 실패")
        return

    if not setup_test_clinics():
        print("❌ 테스트 환경 설정 실패")
        return

    if not run_stress_test():
        print("❌ 부하 테스트 실패")
        return

    show_results()

    # 총 실행 시간
    total_time = time.time() - start_time

    print_header("테스트 완료")
    print(f"⏱️  총 실행 시간: {total_time:.1f}초")
    print("🎉 보충 예약 시스템 부하 테스트가 성공적으로 완료되었습니다!")
    print("")
    print("📝 추가 정보:")
    print("   • 상세 로그: clinic_test.log")
    print("   • 테스트 스크립트: backend/scripts/clinic_reservation_stress_test.py")
    print("   • 클리닉 관리: python backend/manage.py setup_test_clinics --help")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⏹️  프로그램이 중단되었습니다")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류가 발생했습니다: {str(e)}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
