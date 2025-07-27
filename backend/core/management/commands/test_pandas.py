from django.core.management.base import BaseCommand


class Command(BaseCommand):
    """
    pandas 임포트 및 기본 기능 테스트 명령어

    Usage:
        python manage.py test_pandas
    """

    help = "pandas 라이브러리 임포트 및 기본 기능 테스트"

    def handle(self, *args, **options):
        self.stdout.write("🔍 pandas 라이브러리 테스트 시작...")

        try:
            # pandas 임포트 테스트
            self.stdout.write("📦 pandas 임포트 중...")
            import pandas as pd
            import numpy as np

            self.stdout.write(
                self.style.SUCCESS(f"✅ pandas 임포트 성공! 버전: {pd.__version__}")
            )
            self.stdout.write(
                self.style.SUCCESS(f"✅ numpy 임포트 성공! 버전: {np.__version__}")
            )

            # 기본 데이터프레임 생성 및 조작 테스트
            self.stdout.write("\n📊 기본 데이터프레임 생성 테스트...")
            df = pd.DataFrame(
                {
                    "name": ["김철수", "이영희", "박민수"],
                    "age": [20, 25, 30],
                    "score": [85, 92, 78],
                }
            )

            self.stdout.write(
                f"데이터프레임 생성 완료: {len(df)}행 {len(df.columns)}열"
            )
            self.stdout.write(f"컬럼: {list(df.columns)}")

            # isna() 함수 테스트
            self.stdout.write("\n🔍 isna() 함수 테스트...")
            test_data = pd.DataFrame(
                {"phone": ["010-1234-5678", None, "010-9876-5432", ""]}
            )

            na_count = test_data["phone"].isna().sum()
            self.stdout.write(f"결측값 개수: {na_count}개")

            # 엑셀 파일 생성 테스트 (메모리에서만)
            self.stdout.write("\n📝 엑셀 데이터 처리 테스트...")
            from io import BytesIO

            # 메모리 상의 엑셀 파일 생성
            excel_buffer = BytesIO()
            df.to_excel(excel_buffer, index=False)
            excel_buffer.seek(0)

            # 생성된 엑셀 파일 읽기
            test_df = pd.read_excel(excel_buffer)
            self.stdout.write(f"엑셀 파일 생성/읽기 성공: {len(test_df)}행")

            self.stdout.write(
                self.style.SUCCESS(
                    "\n🎉 모든 pandas 테스트가 성공적으로 완료되었습니다!"
                )
            )

        except ImportError as e:
            self.stdout.write(self.style.ERROR(f"❌ pandas 임포트 실패: {str(e)}"))
            self.stdout.write(
                self.style.ERROR(
                    "해결 방법: pip install pandas numpy 또는 pip install -r requirements.txt"
                )
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ pandas 테스트 중 오류 발생: {str(e)}")
            )
            import traceback

            self.stdout.write(traceback.format_exc())
